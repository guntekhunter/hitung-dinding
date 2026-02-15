export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export function polygonArea(points: Point[]): number {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
}

export function polygonPerimeter(points: Point[]): number {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        sum += Math.hypot(
            points[j].x - points[i].x,
            points[j].y - points[i].y
        );
    }
    return sum;
}

export function subtractRect(subject: Rect, clip: Rect): Rect[] {
    const intersection = getIntersection(subject, clip);
    if (!intersection) return [subject];

    const result: Rect[] = [];

    // Top
    if (subject.y < intersection.y) {
        result.push({
            x: subject.x,
            y: subject.y,
            width: subject.width,
            height: intersection.y - subject.y
        });
    }
    // Bottom
    if (subject.y + subject.height > intersection.y + intersection.height) {
        result.push({
            x: subject.x,
            y: intersection.y + intersection.height,
            width: subject.width,
            height: (subject.y + subject.height) - (intersection.y + intersection.height)
        });
    }
    // Left (vertical span of intersection only)
    if (subject.x < intersection.x) {
        result.push({
            x: subject.x,
            y: intersection.y,
            width: intersection.x - subject.x,
            height: intersection.height
        });
    }
    // Right (vertical span of intersection only)
    if (subject.x + subject.width > intersection.x + intersection.width) {
        result.push({
            x: intersection.x + intersection.width,
            y: intersection.y,
            width: (subject.x + subject.width) - (intersection.x + intersection.width),
            height: intersection.height
        });
    }

    return result;
}

function getIntersection(r1: Rect, r2: Rect): Rect | null {
    const x1 = Math.max(r1.x, r2.x);
    const y1 = Math.max(r1.y, r2.y);
    const x2 = Math.min(r1.x + r1.width, r2.x + r2.width);
    const y2 = Math.min(r1.y + r1.height, r2.y + r2.height);

    if (x2 <= x1 || y2 <= y1) return null;

    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function isRectInPolygon(rect: Rect, polygon: Point[]): boolean {
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y + rect.height }
    ];
    return corners.every(corner => isPointInPolygon(corner, polygon));
}

export function getPolygonRectIntersectionArea(polygon: Point[], rect: Rect): number {
    if (polygon.length < 3) return 0;

    let clipped = polygon;

    // Use absolute values for width and height in case they are negative
    const r = {
        x: rect.width > 0 ? rect.x : rect.x + rect.width,
        y: rect.height > 0 ? rect.y : rect.y + rect.height,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height)
    };

    // Clip against the 4 edges of the rectangle
    // Left
    clipped = clipPolygonAgainstEdge(clipped, p => p.x >= r.x, (p1, p2) => {
        const t = (r.x - p1.x) / (p2.x - p1.x);
        return { x: r.x, y: p1.y + t * (p2.y - p1.y) };
    });
    if (clipped.length < 3) return 0;

    // Right
    const right = r.x + r.width;
    clipped = clipPolygonAgainstEdge(clipped, p => p.x <= right, (p1, p2) => {
        const t = (right - p1.x) / (p2.x - p1.x);
        return { x: right, y: p1.y + t * (p2.y - p1.y) };
    });
    if (clipped.length < 3) return 0;

    // Top
    clipped = clipPolygonAgainstEdge(clipped, p => p.y >= r.y, (p1, p2) => {
        const t = (r.y - p1.y) / (p2.y - p1.y);
        return { x: p1.x + t * (p2.x - p1.x), y: r.y };
    });
    if (clipped.length < 3) return 0;

    // Bottom
    const bottom = r.y + r.height;
    clipped = clipPolygonAgainstEdge(clipped, p => p.y <= bottom, (p1, p2) => {
        const t = (bottom - p1.y) / (p2.y - p1.y);
        return { x: p1.x + t * (p2.x - p1.x), y: bottom };
    });
    if (clipped.length < 3) return 0;

    return polygonArea(clipped);
}

function clipPolygonAgainstEdge(
    polygon: Point[],
    isInside: (p: Point) => boolean,
    intersect: (p1: Point, p2: Point) => Point
): Point[] {
    const result: Point[] = [];
    if (polygon.length === 0) return result;

    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];

        const p1Inside = isInside(p1);
        const p2Inside = isInside(p2);

        if (p1Inside && p2Inside) {
            result.push(p2);
        } else if (p1Inside && !p2Inside) {
            result.push(intersect(p1, p2));
        } else if (!p1Inside && p2Inside) {
            result.push(intersect(p1, p2));
            result.push(p2);
        }
    }
    return result;
}
