export interface TrapConfig {
  width: number;
  dropHeight: number;
  gap: number;
}

export interface CeilingInput {
  roomWidth: number; // in cm
  roomLength: number; // in cm
  panelWidth: number; // in cm (default 20)
  panelLength: number; // in cm (default 400 or 600)
  direction: 'horizontal' | 'vertical'; // horizontal = parallel to width, vertical = parallel to length
  traps: TrapConfig[];
}

export interface Cut {
  length: number;
  isReuse: boolean;
  sourceOffcutIndex?: number;
}

export interface PanelResult {
  id: number;
  originalLength: number;
  cuts: Cut[];
  remaining: number;
}

export interface OptimizationResult {
  totalPanels: number;
  totalWasteCm: number;
  wastePercentage: number;
  panels: PanelResult[];
}

function getSurfaces(input: CeilingInput) {
  const surfaces: { w: number; l: number; label: string }[] = [];
  let currentW = input.roomWidth;
  let currentL = input.roomLength;

  input.traps.forEach((trap, i) => {
    // 1. Horizontal Trap surface (the outer level)
    if (trap.width > 0) {
      surfaces.push({ w: currentW, l: trap.width, label: `Trap ${i + 1} H-Surface (Top/Bottom)` });
      surfaces.push({ w: currentW, l: trap.width, label: `Trap ${i + 1} H-Surface (Top/Bottom)` });
      const sideL = currentL - 2 * trap.width;
      if (sideL > 0) {
        surfaces.push({ w: trap.width, l: sideL, label: `Trap ${i + 1} H-Surface (Left/Right)` });
        surfaces.push({ w: trap.width, l: sideL, label: `Trap ${i + 1} H-Surface (Left/Right)` });
      }
      currentW -= 2 * trap.width;
      currentL -= 2 * trap.width;
    }

    // 2. Vertical Drop
    if (currentW > 0 && currentL > 0 && trap.dropHeight > 0) {
      surfaces.push({ w: currentW, l: trap.dropHeight, label: `Trap ${i + 1} V-Drop (Top/Bottom)` });
      surfaces.push({ w: currentW, l: trap.dropHeight, label: `Trap ${i + 1} V-Drop (Top/Bottom)` });
      surfaces.push({ w: trap.dropHeight, l: currentL, label: `Trap ${i + 1} V-Drop (Left/Right)` });
      surfaces.push({ w: trap.dropHeight, l: currentL, label: `Trap ${i + 1} V-Drop (Left/Right)` });
    }

    // 3. Gap to next trap (Inner horizontal surface before the next trap drops)
    if (trap.gap > 0 && currentW > 0 && currentL > 0) {
      surfaces.push({ w: currentW, l: trap.gap, label: `Trap ${i + 1} Gap (Top/Bottom)` });
      surfaces.push({ w: currentW, l: trap.gap, label: `Trap ${i + 1} Gap (Top/Bottom)` });
      const gapSideL = currentL - 2 * trap.gap;
      if (gapSideL > 0) {
        surfaces.push({ w: trap.gap, l: gapSideL, label: `Trap ${i + 1} Gap (Left/Right)` });
        surfaces.push({ w: trap.gap, l: gapSideL, label: `Trap ${i + 1} Gap (Left/Right)` });
      }
      currentW -= 2 * trap.gap;
      currentL -= 2 * trap.gap;
    }
  });

  if (currentW > 0 && currentL > 0) {
    surfaces.push({ w: currentW, l: currentL, label: 'Main Ceiling' });
  }

  return surfaces;
}

export function optimizeCeiling(input: CeilingInput): OptimizationResult {
  const surfaces = getSurfaces(input);
  const pieces: number[] = [];

  // Convert surfaces to strips
  surfaces.forEach(surf => {
    let pieceLength = 0;
    let crossLength = 0;

    if (input.direction === 'horizontal') {
      pieceLength = surf.w;
      crossLength = surf.l;
    } else {
      pieceLength = surf.l;
      crossLength = surf.w;
    }

    const numStrips = Math.ceil(crossLength / input.panelWidth);
    for (let i = 0; i < numStrips; i++) {
      pieces.push(pieceLength);
    }
  });

  // Sort descending (Largest pieces first)
  pieces.sort((a, b) => b - a);

  const panels: PanelResult[] = [];
  let panelCount = 0;
  
  interface Offcut {
    length: number;
    panelId: number;
  }
  let inventory: Offcut[] = [];

  pieces.forEach(piece => {
    // Best fit: smallest offcut that is >= piece
    let bestIdx = -1;
    let bestFitRemainder = Infinity;

    for (let i = 0; i < inventory.length; i++) {
      const offcut = inventory[i];
      if (offcut.length >= piece) {
        const remainder = offcut.length - piece;
        if (remainder < bestFitRemainder) {
          bestFitRemainder = remainder;
          bestIdx = i;
        }
      }
    }

    if (bestIdx !== -1) {
      // Reuse offcut
      const bestOffcut = inventory[bestIdx];
      inventory.splice(bestIdx, 1);

      const panel = panels.find(p => p.id === bestOffcut.panelId)!;
      panel.cuts.push({ length: piece, isReuse: true, sourceOffcutIndex: panel.cuts.length });
      panel.remaining -= piece;

      if (bestFitRemainder > 0) {
        inventory.push({ length: bestFitRemainder, panelId: bestOffcut.panelId });
      }
    } else {
      // Need a new panel
      panelCount++;
      const remainder = input.panelLength - piece;
      const newPanel: PanelResult = {
        id: panelCount,
        originalLength: input.panelLength,
        cuts: [{ length: piece, isReuse: false }],
        remaining: remainder
      };
      panels.push(newPanel);

      if (remainder > 0) {
        inventory.push({ length: remainder, panelId: panelCount });
      }
    }
  });

  const totalWasteCm = inventory.reduce((sum, offcut) => sum + offcut.length, 0);
  const totalMaterialCm = panelCount * input.panelLength;
  const wastePercentage = totalMaterialCm > 0 ? (totalWasteCm / totalMaterialCm) * 100 : 0;

  return {
    totalPanels: panelCount,
    totalWasteCm,
    wastePercentage,
    panels
  };
}
