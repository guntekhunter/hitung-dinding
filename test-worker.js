const fs = require('fs');
// mock geometry
const SCALE = 100;
function normalizeRect(r) {
    return {
        x: r.width > 0 ? r.x : r.x + r.width,
        y: r.height > 0 ? r.y : r.y + r.height,
        width: Math.abs(r.width),
        height: Math.abs(r.height)
    };
}
function getIntersection(r1, r2) {
    const x1 = Math.max(r1.x, r2.x);
    const y1 = Math.max(r1.y, r2.y);
    const x2 = Math.min(r1.x + r1.width, r2.x + r2.width);
    const y2 = Math.min(r1.y + r1.height, r2.y + r2.height);
    if (x2 <= x1 || y2 <= y1) return null;
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
function subtractRect(subject, clip) {
    const intersection = getIntersection(subject, clip);
    if (!intersection) return [subject];
    const result = [];
    if (subject.y < intersection.y) {
        result.push({ x: subject.x, y: subject.y, width: subject.width, height: intersection.y - subject.y });
    }
    if (subject.y + subject.height > intersection.y + intersection.height) {
        result.push({ x: subject.x, y: intersection.y + intersection.height, width: subject.width, height: (subject.y + subject.height) - (intersection.y + intersection.height) });
    }
    if (subject.x < intersection.x) {
        result.push({ x: subject.x, y: intersection.y, width: intersection.x - subject.x, height: intersection.height });
    }
    if (subject.x + subject.width > intersection.x + intersection.width) {
        result.push({ x: intersection.x + intersection.width, y: intersection.y, width: (subject.x + subject.width) - (intersection.x + intersection.width), height: intersection.height });
    }
    return result;
}
function getPolygonRectIntersectionArea(polygon, rect) {
    return rect.width * rect.height; // mock
}

const wall = {
    points: [],
    designAreas: [
        { id: '1', productId: 'wallboard', x: 0, y: 0, width: 300, height: 300, createdAt: 1 },
        { id: '2', productId: 'uv', x: 100, y: 100, width: 100, height: 100, createdAt: 2 }
    ],
    openings: [],
    lists: []
};
const products = [
    { id: 'wallboard', countType: 'area', width: 0.15, height: 2.9 },
    { id: 'uv', countType: 'area', width: 1.22, height: 2.44 }
];

const productAreas = {};
const productFractionalStrips = {};
const addAreaStrips = (pid, heightM, fractional) => {
    const key = Math.round(heightM * 1000) / 1000;
    if (!productFractionalStrips[pid]) productFractionalStrips[pid] = {};
    productFractionalStrips[pid][key] = (productFractionalStrips[pid][key] || 0) + fractional;
};

const uniqueAreaProductIds = ['wallboard', 'uv'];
const sortedDesignAreas = [...wall.designAreas].sort((a, b) => a.createdAt - b.createdAt);
const openingsRects = [];

uniqueAreaProductIds.forEach(pid => {
    const product = products.find(p => p.id === pid);
    let finalRectsForProduct = [];
    sortedDesignAreas.forEach((da, index) => {
        if (da.productId !== pid) return;
        let pieces = [normalizeRect(da)];
        for (let i = index + 1; i < sortedDesignAreas.length; i++) {
            const frontDa = sortedDesignAreas[i];
            const frontRect = normalizeRect(frontDa);
            let nextPieces = [];
            pieces.forEach(p => { nextPieces.push(...subtractRect(p, frontRect)); });
            pieces = nextPieces;
        }
        finalRectsForProduct.push(...pieces);
    });
    
    let totalAreaM2 = 0;
    finalRectsForProduct.forEach(r => {
        totalAreaM2 += getPolygonRectIntersectionArea(wall.points, r);
        addAreaStrips(pid, r.height / SCALE, r.width / SCALE / product.width);
    });
    productAreas[pid] = totalAreaM2 / (SCALE * SCALE);
});

console.log("Fractional strips:", JSON.stringify(productFractionalStrips, null, 2));
