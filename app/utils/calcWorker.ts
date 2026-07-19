// app/utils/calcWorker.ts
import { getPolygonRectIntersectionArea, subtractRect, Rect, Point } from "../function/geometry";

interface WorkerWall {
    id: string;
    points: Point[];
    designAreas: any[];
    openings: any[];
    lists: any[];
}

interface WorkerProduct {
    id: string;
    countType: 'area' | 'length' | 'meter';
    width?: number;
    height?: number;
    unitLength?: number;
}

const SCALE = 100;

const normalizeRect = (r: { x: number; y: number; width: number; height: number }) => ({
    x: r.width > 0 ? r.x : r.x + r.width,
    y: r.height > 0 ? r.y : r.y + r.height,
    width: Math.abs(r.width),
    height: Math.abs(r.height)
});

/**
 * For area products (e.g. wall panels), count strips by width.
 * Each area contributes fractional strip count = area.width / panelWidth.
 * We aggregate fractional strips globally (keyed by height), then ceil per height bucket.
 * This lets edge-cut offcuts be shared across separate design areas of the same height.
 *
 * For length products (e.g. skirting), track each discrete segment length.
 * The cut simulation in the message handler reuses leftover pieces.
 */
const calculateWallMetrics = (wall: WorkerWall, products: WorkerProduct[]) => {
    const productAreas: Record<string, number> = {};
    const productLengths: Record<string, number> = {};

    // Area products: { pid -> { heightKey -> fractionalStripCount } }
    const productFractionalStrips: Record<string, Record<number, number>> = {};
    // Length products: { pid -> number[] } discrete cut lengths
    const productRequiredCuts: Record<string, number[]> = {};

    const addAreaStrips = (pid: string, heightM: number, fractional: number) => {
        const key = Math.round(heightM * 1000) / 1000;
        if (!productFractionalStrips[pid]) productFractionalStrips[pid] = {};
        productFractionalStrips[pid][key] = (productFractionalStrips[pid][key] || 0) + fractional;
    };

    const uniqueAreaProductIds = Array.from(new Set(wall.designAreas.map(da => da.productId)));

    uniqueAreaProductIds.forEach(pid => {
        const product = products.find(p => p.id === pid);
        if (!product) return;

        if (product.countType === 'area') {
            const boardW = product.width || 0.15;

            let materialRects = wall.designAreas
                .filter((da: any) => da.productId === pid)
                .map((da: any) => normalizeRect(da));

            let nonOverlappingMaterialRects: Rect[] = [];
            materialRects.forEach(rect => {
                let pieces = [rect];
                nonOverlappingMaterialRects.forEach(other => {
                    let nextPieces: Rect[] = [];
                    pieces.forEach(p => { nextPieces.push(...subtractRect(p, other)); });
                    pieces = nextPieces;
                });
                nonOverlappingMaterialRects.push(...pieces);
            });

            let finalRects = nonOverlappingMaterialRects;
            wall.openings.map(op => normalizeRect(op)).forEach(opening => {
                let nextFinal: Rect[] = [];
                finalRects.forEach(r => { nextFinal.push(...subtractRect(r, opening)); });
                finalRects = nextFinal;
            });

            let totalAreaM2 = 0;
            finalRects.forEach(r => {
                totalAreaM2 += getPolygonRectIntersectionArea(wall.points, r);
                // Track fractional strip count (aggregated globally for cross-area reuse)
                const rWM = r.width / SCALE;
                const rHM = r.height / SCALE;
                addAreaStrips(pid, rHM, rWM / boardW);
            });
            productAreas[pid] = (productAreas[pid] || 0) + totalAreaM2 / (SCALE * SCALE);

        } else if (product.countType === 'length' || product.countType === 'meter') {
            // length-type: perimeter per design area
            wall.designAreas.filter(da => da.productId === pid).forEach(da => {
                const wM = Math.abs(da.width) / SCALE;
                const hM = Math.abs(da.height) / SCALE;
                const peri = wM * 2 + hM * 2;
                productAreas[pid] = (productAreas[pid] || 0) + peri;
                productLengths[pid] = (productLengths[pid] || 0) + peri;
                if (!productRequiredCuts[pid]) productRequiredCuts[pid] = [];
                productRequiredCuts[pid].push(wM, wM, hM, hM);
            });
        }
    });

    wall.lists.forEach((list: any) => {
        const lengthM = Math.hypot(list.x2 - list.x1, list.y2 - list.y1) / SCALE;
        productLengths[list.productId] = (productLengths[list.productId] || 0) + lengthM;
        if (!productRequiredCuts[list.productId]) productRequiredCuts[list.productId] = [];
        productRequiredCuts[list.productId].push(lengthM);
    });

    const totalDesignArea = Object.values(productAreas).reduce((a, b) => a + b, 0);
    return { productAreas, productLengths, productFractionalStrips, productRequiredCuts, totalDesignArea };
};

self.onmessage = (e: MessageEvent) => {
    const { type, data, requestId } = e.data;

    if (type === "warmup") {
        self.postMessage({ requestId, success: true });
        return;
    }

    if (type === 'CALCULATE_PROJECT_METRICS') {
        const { walls, products, wastePercentage } = data;

        // Aggregate fractional strips across all walls (per product, per height bucket)
        const allFractionalStrips: Record<string, Record<number, number>> = {};
        // Aggregate discrete cut lengths for length products
        const allLengthCuts: Record<string, number[]> = {};
        const wallMetricsResults: any[] = [];

        walls.forEach((wall: WorkerWall) => {
            const metrics = calculateWallMetrics(wall, products);
            wallMetricsResults.push(metrics);

            Object.entries(metrics.productFractionalStrips).forEach(([pid, heightMap]) => {
                if (!allFractionalStrips[pid]) allFractionalStrips[pid] = {};
                Object.entries(heightMap).forEach(([hKey, frac]) => {
                    const h = parseFloat(hKey);
                    allFractionalStrips[pid][h] = (allFractionalStrips[pid][h] || 0) + (frac as number);
                });
            });

            Object.entries(metrics.productRequiredCuts).forEach(([pid, cuts]) => {
                if (!allLengthCuts[pid]) allLengthCuts[pid] = [];
                allLengthCuts[pid].push(...(cuts as number[]));
            });
        });

        const productTotalCounts: Record<string, number> = {};
        const wasteMult = (1 + wastePercentage / 100);

        products.forEach((product: WorkerProduct) => {
            if (product.countType === 'area') {
                const heightMap = allFractionalStrips[product.id] || {};
                const panelHeight = product.height || 2.9;

                // Build the discrete list of strip heights needed
                // Each height bucket: ceil(fractional total) = integer strips needed
                const strips: number[] = [];
                Object.entries(heightMap).forEach(([hKey, frac]) => {
                    const h = parseFloat(hKey);
                    const count = Math.ceil(frac as number);
                    for (let i = 0; i < count; i++) strips.push(h);
                });

                if (strips.length === 0) return;

                // Per height bucket, calculate panels needed correctly for both cases:
                // Case A — wall height <= panel height: one panel covers multiple strip heights
                //   stripsPerPanel = floor(panelH / stripH), panels = ceil(totalStrips / stripsPerPanel)
                //
                // Case B — wall height > panel height: each strip column needs multiple panels
                //   fullRows       = floor(stripH / panelH)  → panels consumed in full rows
                //   gapH           = stripH - fullRows * panelH
                //   If gapH > 0:   one panel can provide floor(panelH / gapH) gap pieces
                //                  gapPanels = ceil(totalStrips / gapPiecesPerPanel)
                //   total = totalStrips * fullRows + gapPanels
                const panelsByBucket: number[] = [];
                Object.entries(heightMap).forEach(([hKey, frac]) => {
                    const stripH = parseFloat(hKey);
                    const totalStrips = Math.ceil(frac as number);

                    if (stripH <= panelHeight) {
                        // Case A: panel taller than (or equal to) wall
                        const stripsPerPanel = Math.max(1, Math.floor(panelHeight / stripH));
                        panelsByBucket.push(Math.ceil(totalStrips / stripsPerPanel));
                    } else {
                        // Case B: wall taller than panel
                        const fullRows = Math.floor(stripH / panelHeight);
                        const gapH = stripH - fullRows * panelHeight;
                        const panelsForFullRows = totalStrips * fullRows;

                        if (gapH > 0.001) {
                            // Gap pieces are small — many fit from one panel, so share across strips
                            const gapPiecesPerPanel = Math.max(1, Math.floor(panelHeight / gapH));
                            const gapPanels = Math.ceil(totalStrips / gapPiecesPerPanel);
                            panelsByBucket.push(panelsForFullRows + gapPanels);
                        } else {
                            panelsByBucket.push(panelsForFullRows);
                        }
                    }
                });

                const totalPanels = panelsByBucket.reduce((a, b) => a + b, 0);
                productTotalCounts[product.id] = Math.ceil(totalPanels * wasteMult);

            } else if (product.countType === 'length') {
                // Cut-simulation for length products with leftover reuse
                const cuts = allLengthCuts[product.id] || [];
                if (cuts.length === 0) return;
                const unitLen = product.unitLength || 2.9;

                cuts.sort((a, b) => b - a);
                let totalUnits = 0;
                let leftovers: number[] = [];

                cuts.forEach(cutLen => {
                    let remaining = cutLen;
                    while (remaining >= unitLen) { totalUnits++; remaining -= unitLen; }
                    if (remaining < 0.001) return;

                    leftovers.sort((a, b) => a - b);
                    const idx = leftovers.findIndex(l => l >= remaining);
                    if (idx !== -1) {
                        leftovers[idx] -= remaining;
                    } else {
                        totalUnits++;
                        leftovers.push(unitLen - remaining);
                    }
                });

                productTotalCounts[product.id] = Math.ceil(totalUnits * wasteMult);
            } else if (product.countType === 'meter') {
                const cuts = allLengthCuts[product.id] || [];
                if (cuts.length === 0) return;
                const totalMeters = cuts.reduce((acc, cut) => acc + cut, 0);
                productTotalCounts[product.id] = parseFloat((totalMeters * wasteMult).toFixed(2));
            }
        });

        self.postMessage({
            type: 'PROJECT_METRICS_RESULT',
            results: { wallMetrics: wallMetricsResults, totalProductCounts: productTotalCounts },
            requestId
        });
    }
};
