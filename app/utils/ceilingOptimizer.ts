/**
 * PVC Ceiling Optimizer - Based on kalkulator-bahan algorithm
 * Uses scanline polygon intersection + FFD bin packing
 */

export interface TrapConfig {
  width: number;   // cm
  dropHeight: number; // cm
  gap: number;     // cm
}

export interface CeilingInput {
  roomWidth: number;   // cm (X axis)
  roomLength: number;  // cm (Y axis)
  panelWidth: number;  // cm (default 20)
  panelLength: number; // cm (400 or 600)
  direction: 'horizontal' | 'vertical';
  traps: TrapConfig[];
  colors?: string[]; // Colors per zone (Base, Trap 1, Trap 2, ...)
}

export interface OptimizationResult {
  panels: any;
  totalPanels: number;
  totalWasteCm: number;
  wastePercentage: number;
  totalSurfaceAreaSqM: number;
  outerPanels: number;
  innerPanels: number;
  panelsByGroup: Record<string, number>;
  lengthByGroup: Record<string, number>;
  lisDindingSticks: number;
  lisSikuSticks: number;
  luasFlatSqM: number;
  luasDropSqM: number;
  wasteOuter: number;
  wasteInner: number;
}

interface Rect { x: number; y: number; w: number; h: number; }

// Scanline intersection: find where a horizontal/vertical line intersects a rectangle
function getRectsIntersections(rects: Rect[], pos: number, isHorizontal: boolean): number[] {
  const inters: number[] = [];
  for (const r of rects) {
    if (isHorizontal) {
      // Horizontal scanline at y=pos, find x intersections
      if (pos >= r.y && pos < r.y + r.h) {
        inters.push(r.x, r.x + r.w);
      }
    } else {
      // Vertical scanline at x=pos, find y intersections
      if (pos >= r.x && pos < r.x + r.w) {
        inters.push(r.y, r.y + r.h);
      }
    }
  }
  return inters.sort((a, b) => a - b);
}

/**
 * Get required strip cuts for a rectangular area, excluding inner rectangles.
 * Mimics the reference project's getRequiredCuts with processIntersections.
 */
function getRequiredCuts(
  rect: Rect,
  excludeRects: Rect[],
  direction: 'horizontal' | 'vertical',
  panelWidth: number
): number[] {
  const cuts: number[] = [];
  const step = panelWidth;

  if (direction === 'horizontal') {
    // Strips run along X, stacked along Y
    for (let y = rect.y + step / 2; y < rect.y + rect.h; y += step) {
      // Main segment: full width of rect
      const mainStart = rect.x;
      const mainEnd = rect.x + rect.w;

      // Get exclusion segments at this Y
      const excludeInters = getRectsIntersections(excludeRects, y, true);

      let currentStart = mainStart;
      for (let j = 0; j < excludeInters.length; j += 2) {
        const exStart = excludeInters[j];
        const exEnd = excludeInters[j + 1];
        if (exEnd === undefined) continue;

        if (exStart > currentStart && exStart < mainEnd) {
          const len = exStart - currentStart;
          if (len > 0.01) cuts.push(parseFloat(len.toFixed(2)));
          currentStart = exEnd;
        } else if (exStart <= currentStart && exEnd > currentStart) {
          currentStart = Math.max(currentStart, exEnd);
        }
      }
      if (currentStart < mainEnd) {
        const len = mainEnd - currentStart;
        if (len > 0.01) cuts.push(parseFloat(len.toFixed(2)));
      }
    }
  } else {
    // Strips run along Y, stacked along X
    for (let x = rect.x + step / 2; x < rect.x + rect.w; x += step) {
      const mainStart = rect.y;
      const mainEnd = rect.y + rect.h;

      const excludeInters = getRectsIntersections(excludeRects, x, false);

      let currentStart = mainStart;
      for (let j = 0; j < excludeInters.length; j += 2) {
        const exStart = excludeInters[j];
        const exEnd = excludeInters[j + 1];
        if (exEnd === undefined) continue;

        if (exStart > currentStart && exStart < mainEnd) {
          const len = exStart - currentStart;
          if (len > 0.01) cuts.push(parseFloat(len.toFixed(2)));
          currentStart = exEnd;
        } else if (exStart <= currentStart && exEnd > currentStart) {
          currentStart = Math.max(currentStart, exEnd);
        }
      }
      if (currentStart < mainEnd) {
        const len = mainEnd - currentStart;
        if (len > 0.01) cuts.push(parseFloat(len.toFixed(2)));
      }
    }
  }

  return cuts;
}

/**
 * FFD bin packing (from reference materialOptimizer.ts)
 */
function ffdBinPack(cuts: number[], binLength: number): number {
  const sorted = [...cuts].sort((a, b) => b - a);
  const bins: number[] = []; // remaining capacity per bin

  sorted.forEach(cut => {
    // First fit: find first bin that can hold this cut
    let placed = false;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] >= cut) {
        bins[i] = parseFloat((bins[i] - cut).toFixed(4));
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push(parseFloat((binLength - cut).toFixed(4)));
    }
  });

  return bins.length;
}

/**
 * Main optimization function.
 * Mirrors the reference project's calculateMaterials for drop1 ceilings.
 */
export function optimizeCeiling(input: CeilingInput): OptimizationResult {
  const { roomWidth, roomLength, panelWidth, panelLength, direction, traps, colors } = input;

  // Compute all rects for the zones
  const rects: Rect[] = [];
  let currentInset = 0;
  
  // Rect 0: outer boundary (wall)
  rects.push({ x: 0, y: 0, w: roomWidth, h: roomLength });
  
  // Rects for each trap
  traps.forEach(t => {
    currentInset += t.width + t.gap;
    rects.push({
      x: currentInset,
      y: currentInset,
      w: roomWidth - 2 * currentInset,
      h: roomLength - 2 * currentInset
    });
  });

  const numZones = traps.length + 1;
  const zoneCuts: number[][] = Array(numZones).fill(0).map(() => []);

  // ========== HORIZONTAL/VERTICAL CUTS PER ZONE ==========
  for (let i = 0; i < numZones; i++) {
    const outerRect = rects[i];
    if (outerRect.w <= 0 || outerRect.h <= 0) continue;

    const innerRects = [];
    if (i + 1 < numZones) {
      const innerRect = rects[i + 1];
      if (innerRect.w > 0 && innerRect.h > 0) {
        innerRects.push(innerRect);
      }
    }
    
    zoneCuts[i].push(...getRequiredCuts(outerRect, innerRects, direction, panelWidth));
  }

  // ========== VERTICAL DROP CUTS ==========
  let insetForDrop = 0;
  let lisSikuMeters = 0;
  traps.forEach((trap, i) => {
    insetForDrop += trap.width;
    const dropW = roomWidth - 2 * insetForDrop;
    const dropH = roomLength - 2 * insetForDrop;

    if (dropW > 0 && dropH > 0 && trap.dropHeight > 0) {
      const perimeterCm = 2 * (dropW + dropH);
      lisSikuMeters += perimeterCm / 100;
      const numStrips = Math.ceil(perimeterCm / panelWidth);
      
      // Assign drop cuts to the inner zone (i+1)
      for (let j = 0; j < numStrips; j++) {
        zoneCuts[i + 1].push(trap.dropHeight);
      }
    }
    insetForDrop += trap.gap;
  });

  const lisDindingMeters = 2 * (roomWidth + roomLength) / 100;
  const lisDindingSticks = Math.ceil(lisDindingMeters / 4);
  const lisSikuSticks = Math.ceil(lisSikuMeters / 4);

  // ========== AREA CALCULATION ==========
  let luasFlatSqM = (roomWidth * roomLength) / 10000;
  let luasDropSqM = 0;

  let insetForArea = 0;
  traps.forEach(trap => {
    insetForArea += trap.width;
    const dw = roomWidth - 2 * insetForArea;
    const dh = roomLength - 2 * insetForArea;
    if (dw > 0 && dh > 0 && trap.dropHeight > 0) {
      luasDropSqM += (2 * (dw + dh) * trap.dropHeight) / 10000;
    }
    insetForArea += trap.gap;
  });
  
  const totalSurfaceAreaSqM = luasFlatSqM + luasDropSqM;

  // ========== OPTIMIZE EACH POOL BY COLOR ==========
  const colorPools = new Map<string, { cuts: number[], zones: string[] }>();
  
  for (let i = 0; i < numZones; i++) {
    const color = (colors && colors[i]) ? colors[i] : `Zone_${i}`;
    let zoneName = 'Luar / Base';
    if (i > 0 && i < numZones - 1) zoneName = `Trap ${i}`;
    if (i > 0 && i === numZones - 1) zoneName = 'Dalam / Plafon Utama';
    if (numZones === 1) zoneName = 'Plafon Utama';

    if (!colorPools.has(color)) {
      colorPools.set(color, { cuts: [], zones: [] });
    }
    colorPools.get(color)!.cuts.push(...zoneCuts[i]);
    colorPools.get(color)!.zones.push(zoneName);
  }

  let totalPanels = 0;
  let totalUsedM = 0;
  const panelsByGroup: Record<string, number> = {};
  const lengthByGroup: Record<string, number> = {};

  const panelLengthM = panelLength / 100;

  colorPools.forEach((pool, color) => {
    const cutsM = pool.cuts.map(c => parseFloat((c / 100).toFixed(4)));
    const panels = ffdBinPack(cutsM, panelLengthM);
    
    totalPanels += panels;
    const usedM = cutsM.reduce((a, b) => a + b, 0);
    totalUsedM += usedM;

    // Use joined zone names as the group key
    const groupName = pool.zones.join(' + ');
    panelsByGroup[groupName] = panels;
    lengthByGroup[groupName] = pool.cuts.reduce((a, b) => a + b, 0);
  });

  const totalMaterialM = totalPanels * panelLengthM;
  const totalWasteCm = (totalMaterialM - totalUsedM) * 100;
  const wastePercentage = totalMaterialM > 0 ? ((totalMaterialM - totalUsedM) / totalMaterialM) * 100 : 0;

  // Provide dummy values for legacy properties
  const outerPanels = 0;
  const innerPanels = 0;
  const wasteOuter = 0;
  const wasteInner = 0;

  return {
    panels: [],
    totalPanels,
    totalWasteCm,
    wastePercentage,
    totalSurfaceAreaSqM,
    outerPanels,
    innerPanels,
    panelsByGroup,
    lengthByGroup,
    lisDindingSticks,
    lisSikuSticks,
    luasFlatSqM,
    luasDropSqM,
    wasteOuter,
    wasteInner
  };
}
