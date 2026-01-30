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
