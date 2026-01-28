export type Point = { x: number; y: number };

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
