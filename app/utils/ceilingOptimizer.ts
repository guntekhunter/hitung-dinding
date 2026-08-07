/**
 * PVC Ceiling Optimizer - Based on kalkulator-bahan algorithm
 * Uses scanline polygon intersection + FFD bin packing
 */

export interface TrapConfig {
  width: number;   // cm
  dropHeight: number; // cm
  gap: number;     // cm
  panelLength?: number; // cm
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
  const lisSikuCutsM: number[] = [];
  
  traps.forEach((trap, i) => {
    insetForDrop += trap.width;
    const dropW = roomWidth - 2 * insetForDrop;
    const dropH = roomLength - 2 * insetForDrop;

    if (dropW > 0 && dropH > 0 && trap.dropHeight > 0) {
      const perimeterCm = 2 * (dropW + dropH);
      
      // Calculate lis siku cuts (sides of the drop)
      [dropW, dropW, dropH, dropH].forEach(side => {
        let remaining = side / 100;
        while (remaining > 0) {
          if (remaining > 4) {
            lisSikuCutsM.push(4);
            remaining -= 4;
          } else {
            lisSikuCutsM.push(parseFloat(remaining.toFixed(4)));
            remaining = 0;
          }
        }
      });

      const numStrips = Math.ceil(perimeterCm / panelWidth);
      
      // Assign drop cuts to the inner zone (i+1)
      for (let j = 0; j < numStrips; j++) {
        zoneCuts[i + 1].push(trap.dropHeight);
      }
    }
    insetForDrop += trap.gap;
  });

  const lisDindingCutsM: number[] = [];
  [roomWidth, roomWidth, roomLength, roomLength].forEach(side => {
    let remaining = side / 100;
    while (remaining > 0) {
      if (remaining > 4) {
        lisDindingCutsM.push(4);
        remaining -= 4;
      } else {
        lisDindingCutsM.push(parseFloat(remaining.toFixed(4)));
        remaining = 0;
      }
    }
  });

  const lisDindingSticks = ffdBinPack(lisDindingCutsM, 4);
  const lisSikuSticks = ffdBinPack(lisSikuCutsM, 4);

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

  // ========== OPTIMIZE EACH POOL BY COLOR & PANEL LENGTH ==========
  const colorPools = new Map<string, { cuts: number[], zones: string[], panelLengthM: number }>();
  
  for (let i = 0; i < numZones; i++) {
    const color = (colors && colors[i]) ? colors[i] : `Zone_${i}`;
    let zoneName = 'Luar / Base';
    let zonePanelLength = panelLength;
    
    if (i > 0 && i < numZones - 1) {
      zoneName = `Trap ${i}`;
      zonePanelLength = traps[i - 1]?.panelLength || panelLength;
    }
    if (i > 0 && i === numZones - 1) {
      zoneName = 'Dalam / Plafon Utama';
      zonePanelLength = traps[i - 1]?.panelLength || panelLength;
    }
    if (numZones === 1) {
      zoneName = 'Plafon Utama';
      zonePanelLength = panelLength;
    }

    const poolKey = `${color}_${zonePanelLength}`;

    if (!colorPools.has(poolKey)) {
      colorPools.set(poolKey, { cuts: [], zones: [], panelLengthM: zonePanelLength / 100 });
    }
    colorPools.get(poolKey)!.cuts.push(...zoneCuts[i]);
    // only push zoneName if not already in array
    if (!colorPools.get(poolKey)!.zones.includes(zoneName)) {
      colorPools.get(poolKey)!.zones.push(zoneName);
    }
  }

  let totalPanels = 0;
  let totalUsedM = 0;
  let totalMaterialM = 0;
  const panelsByGroup: Record<string, number> = {};
  const lengthByGroup: Record<string, number> = {};

  colorPools.forEach((pool, poolKey) => {
    const plM = pool.panelLengthM;

    // ---------------------------------------------------------------
    // Physical rule:
    //   - Strip span > panel length  → strip needs multiple panels
    //     end-to-end.  The tail offcut of the LAST panel in that strip
    //     CANNOT be reused for any other strip (no gluing allowed).
    //     Count: ceil(span / panelLength) per strip, waste is fixed.
    //
    //   - Strip span ≤ panel length  → offcuts CAN be reused for
    //     other strips in the same colour / panel-length pool.
    //     Use FFD bin-packing as before.
    // ---------------------------------------------------------------

    let directPanels = 0;   // for over-length strips
    let directMaterialM = 0;
    let directUsedM = 0;
    const packableCutsM: number[] = [];  // for ≤-panel-length strips

    pool.cuts.forEach(c => {
      const cM = parseFloat((c / 100).toFixed(4));
      if (cM > plM + 0.001) {
        // Over-length strip: panels must join end-to-end.
        // Each joining point is a waste point: the offcut from the
        // final panel in the strip cannot be recycled.
        const stripsNeeded = Math.ceil(cM / plM);
        directPanels     += stripsNeeded;
        directMaterialM  += stripsNeeded * plM;
        directUsedM      += cM;            // only the actual span is "used"
      } else {
        packableCutsM.push(cM);
      }
    });

    // FFD on the short cuts
    const packedPanels = ffdBinPack(packableCutsM, plM);
    const packedUsedM  = packableCutsM.reduce((a, b) => a + b, 0);
    const packedMaterialM = packedPanels * plM;

    const panels = directPanels + packedPanels;
    const usedM  = directUsedM  + packedUsedM;
    const materialM = directMaterialM + packedMaterialM;

    totalPanels     += panels;
    totalUsedM      += usedM;
    totalMaterialM  += materialM;

    // Use joined zone names as the group key, include panel length
    const groupName = pool.zones.join(' + ') + ` (${plM * 100}cm)`;
    panelsByGroup[groupName] = panels;
    lengthByGroup[groupName] = pool.cuts.reduce((a, b) => a + b, 0);
  });

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
