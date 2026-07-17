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
  const { roomWidth, roomLength, panelWidth, panelLength, direction, traps } = input;

  // Room rectangle (outer boundary)
  const roomRect: Rect = { x: 0, y: 0, w: roomWidth, h: roomLength };

  // Calculate inset for the inner ceiling area
  let totalInset = 0;
  traps.forEach(t => {
    totalInset += t.width + t.gap;
  });

  // Inner rectangle (after all trap insets)
  const innerRect: Rect = {
    x: totalInset,
    y: totalInset,
    w: roomWidth - 2 * totalInset,
    h: roomLength - 2 * totalInset
  };

  const hasTraps = traps.length > 0 && totalInset > 0;
  const innerValid = innerRect.w > 0 && innerRect.h > 0;

  // ========== OUTER CUTS (Trap area = room minus inner) ==========
  const outerCuts: number[] = [];
  if (hasTraps && innerValid) {
    outerCuts.push(...getRequiredCuts(roomRect, [innerRect], direction, panelWidth));
  } else if (!hasTraps) {
    // No traps: everything is "inner" (flat ceiling)
  } else {
    // Inner is too small, whole room is outer
    outerCuts.push(...getRequiredCuts(roomRect, [], direction, panelWidth));
  }

  // ========== INNER CUTS (Plafon Utama) ==========
  const innerCuts: number[] = [];
  if (hasTraps && innerValid) {
    innerCuts.push(...getRequiredCuts(innerRect, [], direction, panelWidth));
  } else if (!hasTraps) {
    // Flat ceiling: everything is inner
    innerCuts.push(...getRequiredCuts(roomRect, [], direction, panelWidth));
  }

  // ========== VERTICAL DROP CUTS ==========
  // Each trap has a vertical drop surface around the inner perimeter
  let currentInsetForDrop = 0;
  let lisSikuMeters = 0;
  traps.forEach(trap => {
    currentInsetForDrop += trap.width;
    const dropW = roomWidth - 2 * currentInsetForDrop;
    const dropH = roomLength - 2 * currentInsetForDrop;

    if (dropW > 0 && dropH > 0 && trap.dropHeight > 0) {
      const perimeterCm = 2 * (dropW + dropH);
      lisSikuMeters += perimeterCm / 100;
      const numStrips = Math.ceil(perimeterCm / panelWidth);
      for (let i = 0; i < numStrips; i++) {
        innerCuts.push(trap.dropHeight); // drop cuts belong to inner (Bagian Dalam)
      }
    }
    currentInsetForDrop += trap.gap;
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

  // ========== OPTIMIZE EACH POOL ==========
  // Convert all cuts to meters before packing to perfectly match reference app float packing
  const outerCutsM = outerCuts.map(c => parseFloat((c / 100).toFixed(4)));
  const innerCutsM = innerCuts.map(c => parseFloat((c / 100).toFixed(4)));
  const panelLengthM = panelLength / 100;

  const outerPanels = ffdBinPack(outerCutsM, panelLengthM);
  const innerPanels = ffdBinPack(innerCutsM, panelLengthM);
  const totalPanels = outerPanels + innerPanels;

  const totalMaterialM = totalPanels * panelLengthM;
  const totalUsedM = [...outerCutsM, ...innerCutsM].reduce((a, b) => a + b, 0);
  const totalWasteCm = (totalMaterialM - totalUsedM) * 100;
  const wastePercentage = totalMaterialM > 0 ? ((totalMaterialM - totalUsedM) / totalMaterialM) * 100 : 0;

  // Build per-group breakdown
  const panelsByGroup: Record<string, number> = {};
  const lengthByGroup: Record<string, number> = {};

  if (hasTraps) {
    panelsByGroup['Trap 1'] = outerPanels;
    lengthByGroup['Trap 1'] = outerCuts.reduce((a, b) => a + b, 0);
    panelsByGroup['Plafon Utama'] = innerPanels;
    lengthByGroup['Plafon Utama'] = innerCuts.reduce((a, b) => a + b, 0);
  } else {
    panelsByGroup['Plafon Utama'] = innerPanels;
    lengthByGroup['Plafon Utama'] = innerCuts.reduce((a, b) => a + b, 0);
  }

  const outerMaterialM = outerPanels * panelLengthM;
  const outerUsedM = outerCutsM.reduce((a, b) => a + b, 0);
  const wasteOuter = (outerMaterialM > 0) ? ((outerMaterialM - outerUsedM) / outerMaterialM) * 100 : 0;

  const innerMaterialM = innerPanels * panelLengthM;
  const innerUsedM = innerCutsM.reduce((a, b) => a + b, 0);
  const wasteInner = (innerMaterialM > 0) ? ((innerMaterialM - innerUsedM) / innerMaterialM) * 100 : 0;

  return {
    panels: [], // Added to satisfy the interface requirement from page.tsx
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
