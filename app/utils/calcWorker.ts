// app/utils/calcWorker.ts
import { getPolygonRectIntersectionArea, subtractRect, Rect, Point } from "../function/geometry";

// We copy the necessary types here or import them if the worker setup allows
// To keep it simple and robust for a worker, we'll define minimal interfaces
interface WorkerWall {
    id: string;
    points: Point[];
    designAreas: any[];
    openings: any[];
    lists: any[];
}

interface WorkerProduct {
    id: string;
    countType: 'area' | 'length';
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

const calculateWallMetrics = (wall: WorkerWall, products: WorkerProduct[]) => {
    const productAreas: Record<string, number> = {};
    const productRequiredCuts: Record<string, number[]> = {};
    
    const addCuts = (pid: string, len: number, count: number = 1) => {
        if (!productRequiredCuts[pid]) productRequiredCuts[pid] = [];
        for (let i = 0; i < count; i++) {
            productRequiredCuts[pid].push(len);
        }
    };

    const uniqueAreaProductIds = Array.from(new Set(wall.designAreas.map(da => da.productId)));
    
    uniqueAreaProductIds.forEach(pid => {
        const product = products.find(p => p.id === pid);
        if (!product) return;

        if (product.countType === 'area') {
            let materialRects = wall.designAreas
                .filter((da: any) => da.productId === pid)
                .map((da: any) => normalizeRect(da));
                
            let nonOverlappingMaterialRects: Rect[] = [];
            materialRects.forEach(rect => {
                let pieces = [rect];
                nonOverlappingMaterialRects.forEach(other => {
                    let nextPieces: Rect[] = [];
                    pieces.forEach(p => {
                        nextPieces.push(...subtractRect(p, other));
                    });
                    pieces = nextPieces;
                });
                nonOverlappingMaterialRects.push(...pieces);
            });

            let finalRects = nonOverlappingMaterialRects;
            wall.openings.map(op => normalizeRect(op)).forEach(opening => {
                let nextFinal: Rect[] = [];
                finalRects.forEach(r => {
                    nextFinal.push(...subtractRect(r, opening));
                });
                finalRects = nextFinal;
            });

            const boardW = product.width || 0.15;
            let totalAreaM2 = 0;

            finalRects.forEach(r => {
                totalAreaM2 += getPolygonRectIntersectionArea(wall.points, r);
                
                // Cut Logic Simulation
                const rWM = r.width / SCALE;
                const rHM = r.height / SCALE;
                const numStrips = Math.ceil(rWM / boardW);
                // For area panels, they are laid vertically, so height is the strip length
                addCuts(pid, rHM, numStrips);
            });
            productAreas[pid] = totalAreaM2 / (SCALE * SCALE);
        } else {
            wall.designAreas.filter(da => da.productId === pid).forEach(da => {
                const wM = Math.abs(da.width) / SCALE;
                const hM = Math.abs(da.height) / SCALE;
                productAreas[pid] = (productAreas[pid] || 0) + (wM * 2 + hM * 2);
                
                // Cut Logic: Perimeter
                addCuts(pid, wM, 2);
                addCuts(pid, hM, 2);
            });
        }
    });

    wall.lists.forEach((list: any) => {
        const lengthM = Math.hypot(list.x2 - list.x1, list.y2 - list.y1) / SCALE;
        addCuts(list.productId, lengthM, 1);
    });

    const totalDesignArea = Object.values(productAreas).reduce((a, b) => a + b, 0);
    return { productAreas, productRequiredCuts, totalDesignArea };
};

self.onmessage = (e: MessageEvent) => {
    const { type, data, requestId } = e.data;

    if (type === "warmup") {
        self.postMessage({
            requestId,
            success: true,
        });
        return;
    }

    if (type === 'CALCULATE_PROJECT_METRICS') {
        const { walls, products, wastePercentage } = data;
        
        const allRequiredCuts: Record<string, number[]> = {};
        const wallMetricsResults: any[] = [];

        walls.forEach((wall: WorkerWall) => {
            const metrics = calculateWallMetrics(wall, products);
            wallMetricsResults.push(metrics);

            Object.entries(metrics.productRequiredCuts).forEach(([pid, cuts]) => {
                if (!allRequiredCuts[pid]) allRequiredCuts[pid] = [];
                allRequiredCuts[pid].push(...cuts);
            });
        });

        const productTotalCounts: Record<string, number> = {};

        products.forEach((product: WorkerProduct) => {
            const cuts = allRequiredCuts[product.id] || [];
            if (cuts.length === 0) return;

            const unitLen = product.countType === 'area' ? (product.height || 2.9) : (product.unitLength || 2.9);
            const wasteMult = (1 + wastePercentage / 100);

            let totalPanelsUsed = 0;
            let leftovers: number[] = [];

            cuts.forEach(cutLen => {
                let remaining = cutLen;

                // Bulk full panels
                while (remaining >= unitLen) {
                    totalPanelsUsed++;
                    remaining -= unitLen;
                }

                // Leftover piece
                if (remaining > 0) {
                    leftovers.sort((a, b) => a - b);
                    let foundIndex = -1;
                    for (let j = 0; j < leftovers.length; j++) {
                        if (leftovers[j] >= remaining) {
                            foundIndex = j;
                            break;
                        }
                    }

                    if (foundIndex !== -1) {
                        leftovers[foundIndex] -= remaining;
                    } else {
                        totalPanelsUsed++;
                        leftovers.push(unitLen - remaining);
                    }
                }
            });

            productTotalCounts[product.id] = Math.ceil(totalPanelsUsed * wasteMult);
        });

        self.postMessage({ 
            type: 'PROJECT_METRICS_RESULT', 
            results: {
                wallMetrics: wallMetricsResults,
                totalProductCounts: productTotalCounts
            }, 
            requestId 
        });
    }
};
