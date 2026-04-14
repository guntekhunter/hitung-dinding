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
    const productLengths: Record<string, number> = {};
    
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

            let totalAreaM2 = 0;
            finalRects.forEach(r => {
                totalAreaM2 += getPolygonRectIntersectionArea(wall.points, r);
            });
            productAreas[pid] = totalAreaM2 / (SCALE * SCALE);
        } else {
            wall.designAreas.filter(da => da.productId === pid).forEach(da => {
                const wM = Math.abs(da.width) / SCALE;
                const hM = Math.abs(da.height) / SCALE;
                productAreas[pid] = (productAreas[pid] || 0) + (wM * 2 + hM * 2);
            });
        }
    });

    wall.lists.forEach((list: any) => {
        const lengthM = Math.hypot(list.x2 - list.x1, list.y2 - list.y1) / SCALE;
        productLengths[list.productId] = (productLengths[list.productId] || 0) + lengthM;
    });

    return { productAreas, productLengths };
};

self.onmessage = (e: MessageEvent) => {
    const { type, data, requestId } = e.data;

    if (type === 'CALCULATE_PROJECT_METRICS') {
        const { walls, products, wastePercentage } = data;
        
        const productAreaSum: Record<string, number> = {};
        const productLengthSum: Record<string, number> = {};
        const productTotalCounts: Record<string, number> = {};
        const wallMetricsResults: any[] = [];

        walls.forEach((wall: WorkerWall) => {
            const metrics = calculateWallMetrics(wall, products);
            wallMetricsResults.push(metrics);

            Object.entries(metrics.productAreas).forEach(([pid, area]) => {
                const product = products.find((p: any) => p.id === pid);
                if (product?.countType === 'area') {
                    productAreaSum[pid] = (productAreaSum[pid] || 0) + area;
                } else if (product?.countType === 'length') {
                    productLengthSum[pid] = (productLengthSum[pid] || 0) + area;
                }
            });
            Object.entries(metrics.productLengths).forEach(([pid, len]) => {
                productLengthSum[pid] = (productLengthSum[pid] || 0) + len;
            });
        });

        products.forEach((product: WorkerProduct) => {
            const wasteMult = (1 + wastePercentage / 100);
            
            if (product.countType === 'area') {
                const totalAreaM2 = productAreaSum[product.id] || 0;
                if (totalAreaM2 > 0) {
                    const boardW = product.width || 0.15;
                    const boardH = product.height || 2.9;
                    const boardAreaM2 = boardW * boardH;
                    productTotalCounts[product.id] = Math.ceil((totalAreaM2 / boardAreaM2) * wasteMult - 0.0001);
                }
            } else if (product.countType === 'length') {
                const totalLengthM = productLengthSum[product.id] || 0;
                if (totalLengthM > 0) {
                    const unitLen = product.unitLength || 2.9;
                    productTotalCounts[product.id] = Math.ceil((totalLengthM / unitLen) * wasteMult - 0.0001);
                }
            }
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
