// app/utils/calcWorker.ts
import { getPolygonRectIntersectionArea } from "../function/geometry";

self.onmessage = (e: MessageEvent) => {
    const { type, data } = e.data;

    if (type === 'CALCULATE_AREA_INTERSECTION') {
        const { polygon, rect } = data;
        const area = getPolygonRectIntersectionArea(polygon, rect);
        self.postMessage({ type: 'AREA_INTERSECTION_RESULT', area });
    }
};
