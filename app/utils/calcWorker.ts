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
    const sortedDesignAreas = [...wall.designAreas].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const openingsRects = wall.openings.filter(op => op.type !== 'tv').map(op => normalizeRect(op));

    uniqueAreaProductIds.forEach(pid => {
        const product = products.find(p => p.id === pid);
        if (!product) return;

        if (product.countType === 'area') {
            const boardW = product.width || 0.15;

            let finalRectsForProduct: Rect[] = [];

            sortedDesignAreas.forEach((da, index) => {
                if (da.productId !== pid) return;

                let pieces = [normalizeRect(da)];

                // Subtract all design areas that are IN FRONT of this one (higher index)
                for (let i = index + 1; i < sortedDesignAreas.length; i++) {
                    const frontDa = sortedDesignAreas[i];
                    const frontRect = normalizeRect(frontDa);
                    let nextPieces: Rect[] = [];
                    pieces.forEach(p => {
                        nextPieces.push(...subtractRect(p, frontRect));
                    });
                    pieces = nextPieces;
                }

                // Also subtract all openings
                openingsRects.forEach(opening => {
                    let nextPieces: Rect[] = [];
                    pieces.forEach(p => {
                        nextPieces.push(...subtractRect(p, opening));
                    });
                    pieces = nextPieces;
                });

                finalRectsForProduct.push(...pieces);
            });

            let totalAreaM2 = 0;
            finalRectsForProduct.forEach(r => {
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

    if (type === 'CALCULATE_AREA_INTERSECTION') {
        const { polygon, rect } = data;
        let area = getPolygonRectIntersectionArea(polygon, rect);
        self.postMessage({
            type: 'AREA_INTERSECTION_RESULT',
            area,
            requestId
        });
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
                const productAreaM2 = (product.width || 1) * (product.height || 1);
                let totalArea = 0;
                wallMetricsResults.forEach(m => {
                    totalArea += (m.productAreas[product.id] || 0);
                });
                
                if (totalArea > 0) {
                    productTotalCounts[product.id] = Math.ceil((totalArea / productAreaM2) * wasteMult);
                }
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
