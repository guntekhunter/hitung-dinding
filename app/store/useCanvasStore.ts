import { create } from "zustand";
import { polygonPerimeter, polygonArea, Point } from "../function/geometry";

export const SCALE = 100; // 100px = 1m (Increased for better dragging)
export const PANEL_WIDTH_METERS = 0.2; // 20cm

export type Product = {
    id: string;
    name: string;
    width: number; // in meters
    height: number; // in meters
    color: string;
};

export const PRODUCTS: Product[] = [
    { id: "wallpanel", name: "Wallpanel (16cm)", width: 0.16, height: 2.9, color: "rgba(14, 165, 233, 0.4)" },
    { id: "wallboard", name: "Wallboard (30cm)", width: 0.30, height: 2.9, color: "rgba(16, 185, 129, 0.4)" },
];

export type DesignArea = {
    id: string;
    productId: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Wall = {
    id: string;
    points: Point[];
    isClosed: boolean;
    area: number;
    perimeter: number;
    name: string;
};

type CanvasState = {
    // Current editing state
    points: Point[];
    isClosed: boolean;
    direction: 'horizontal' | 'vertical';

    // Interaction mode
    interactionMode: 'draw' | 'place' | 'delete';

    // Product state
    selectedProductId: string;
    designAreas: DesignArea[];
    currentDrawingArea: DesignArea | null;

    // Actions
    addPoint: (x: number, y: number) => void;
    updatePoint: (index: number, x: number, y: number) => void;
    updateEdgeLength: (index: number, lengthMeters: number) => void;
    reset: () => void;

    // Product actions
    setSelectedProduct: (id: string) => void;
    setInteractionMode: (mode: 'draw' | 'place' | 'delete') => void;

    // Area Actions
    startDesignArea: (x: number, y: number) => void;
    updateDesignArea: (x: number, y: number) => void;
    finishDesignArea: () => void;
    removeDesignArea: (id: string) => void;
    clearDesignAreas: () => void;

    // Helper to calculate
    getDimensions: () => { area: number; perimeter: number };
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
    points: [],
    isClosed: false,
    direction: 'horizontal',
    interactionMode: 'draw',
    selectedProductId: PRODUCTS[0].id,
    designAreas: [],
    currentDrawingArea: null,

    addPoint: (x, y) => {
        const { points, isClosed } = get();
        if (isClosed) return;

        // Check if closing
        if (points.length >= 3) {
            const first = points[0];
            const dist = Math.hypot(first.x - x, first.y - y);
            if (dist < 20) { // Snap to close
                set({ isClosed: true, interactionMode: 'place' });
                return;
            }
        }
        set({ points: [...points, { x, y }] });
    },

    updatePoint: (index, x, y) => {
        set((state) => {
            const newPoints = [...state.points];
            newPoints[index] = { x, y };
            return { points: newPoints };
        });
    },

    updateEdgeLength: (index, lengthMeters) => {
        set((state) => {
            const points = [...state.points];
            if (index >= points.length) return state;

            const p1 = points[index];
            const p2 = points[(index + 1) % points.length];

            const currentLengthPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const targetLengthPx = lengthMeters * SCALE;

            if (currentLengthPx === 0) return state;

            const ratio = targetLengthPx / currentLengthPx;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            const newX = p1.x + dx * ratio;
            const newY = p1.y + dy * ratio;

            points[(index + 1) % points.length] = { x: newX, y: newY };
            return { points };
        });
    },

    reset: () => set({ points: [], isClosed: false, designAreas: [], interactionMode: 'draw', currentDrawingArea: null }),

    setSelectedProduct: (id) => set({ selectedProductId: id }),

    setInteractionMode: (mode) => set({ interactionMode: mode }),

    startDesignArea: (x, y) => {
        const { selectedProductId } = get();
        set({
            currentDrawingArea: {
                id: 'temp',
                productId: selectedProductId,
                x,
                y,
                width: 0,
                height: 0
            }
        });
    },

    updateDesignArea: (x, y) => {
        set((state) => {
            if (!state.currentDrawingArea) return state;
            return {
                currentDrawingArea: {
                    ...state.currentDrawingArea,
                    width: x - state.currentDrawingArea.x,
                    height: y - state.currentDrawingArea.y
                }
            };
        });
    },

    finishDesignArea: () => {
        set((state) => {
            if (!state.currentDrawingArea) return state;
            // Only add if it has some dimension
            if (Math.abs(state.currentDrawingArea.width) < 5 || Math.abs(state.currentDrawingArea.height) < 5) {
                return { currentDrawingArea: null };
            }

            // Normalize rectangle (handle negative width/height from dragging left/up)
            const normalized: DesignArea = {
                id: Math.random().toString(36).substr(2, 9),
                productId: state.currentDrawingArea.productId,
                x: state.currentDrawingArea.width > 0 ? state.currentDrawingArea.x : state.currentDrawingArea.x + state.currentDrawingArea.width,
                y: state.currentDrawingArea.height > 0 ? state.currentDrawingArea.y : state.currentDrawingArea.y + state.currentDrawingArea.height,
                width: Math.abs(state.currentDrawingArea.width),
                height: Math.abs(state.currentDrawingArea.height),
            };

            return {
                designAreas: [...state.designAreas, normalized],
                currentDrawingArea: null
            };
        });
    },

    removeDesignArea: (id) => {
        set((state) => ({
            designAreas: state.designAreas.filter(a => a.id !== id)
        }));
    },

    clearDesignAreas: () => set({ designAreas: [] }),

    getDimensions: () => {
        const { points, isClosed } = get();
        if (!isClosed || points.length < 3) return { area: 0, perimeter: 0 };
        return {
            area: polygonArea(points) / (SCALE * SCALE), // Convert px^2 to m^2
            perimeter: polygonPerimeter(points) / SCALE, // Convert px to m
        };
    }
}));
