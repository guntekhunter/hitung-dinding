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
    { id: "wallboard", name: "Wallboard (40cm)", width: 0.40, height: 2.9, color: "rgba(16, 185, 129, 0.4)" },
    { id: "wallboard60", name: "Wallboard (60cm)", width: 0.60, height: 2.9, color: "rgba(20, 184, 166, 0.4)" },
    { id: "uvboard", name: "UV Board (122cm)", width: 1.22, height: 2.9, color: "rgba(168, 85, 247, 0.4)" },
];

export type DesignArea = {
    id: string;
    productId: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Opening = {
    id: string;
    type: 'window' | 'door';
    x: number;
    y: number;
    width: number;
    height: number;
};

export type ListElement = {
    id: string;
    type: 'list';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

type HistoryEntry = {
    designAreas: DesignArea[];
    openings: Opening[];
    lists: ListElement[];
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
    interactionMode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list';

    // Product state
    selectedProductId: string;
    designAreas: DesignArea[];
    openings: Opening[];
    lists: ListElement[];
    currentDrawingArea: DesignArea | Opening | null;
    currentDrawingList: ListElement | null;

    // History
    past: HistoryEntry[];
    future: HistoryEntry[];

    // Actions
    addPoint: (x: number, y: number) => void;
    updatePoint: (index: number, x: number, y: number) => void;
    updateEdgeLength: (index: number, lengthMeters: number) => void;
    reset: () => void;

    // Product actions
    setSelectedProduct: (id: string) => void;
    setInteractionMode: (mode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list') => void;

    // Area Actions
    startDesignArea: (x: number, y: number) => void;
    updateDesignArea: (x: number, y: number) => void;
    finishDesignArea: () => void;
    removeDesignArea: (id: string) => void;
    clearDesignAreas: () => void;

    // Opening Actions
    startOpening: (x: number, y: number, type: 'window' | 'door') => void;
    updateOpening: (x: number, y: number) => void;
    finishOpening: () => void;
    removeOpening: (id: string) => void;

    // List Actions
    startList: (x: number, y: number) => void;
    updateList: (x: number, y: number) => void;
    finishList: () => void;
    removeList: (id: string) => void;

    // History Actions
    undo: () => void;
    redo: () => void;

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
    openings: [],
    lists: [],
    currentDrawingArea: null,
    currentDrawingList: null,
    past: [],
    future: [],

    // Internal helper to save state for undo/redo
    _saveHistory: () => {
        const { designAreas, openings, lists, past } = get();
        set({
            past: [...past, { designAreas: [...designAreas], openings: [...openings], lists: [...lists] }],
            future: [], // Clear future when a new action is performed
        });
    },

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

    reset: () => set({ points: [], isClosed: false, designAreas: [], openings: [], lists: [], interactionMode: 'draw', currentDrawingArea: null, currentDrawingList: null }),

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

    startOpening: (x, y, type) => {
        set({
            currentDrawingArea: {
                id: 'temp',
                type,
                x,
                y,
                width: 0,
                height: 0
            } as any // Flexible typing for temp drawing
        });
    },

    updateOpening: (x, y) => {
        get().updateDesignArea(x, y);
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
            if (!state.currentDrawingArea || !('productId' in state.currentDrawingArea)) return state;

            const area = state.currentDrawingArea as DesignArea;

            // Only add if it has some dimension
            if (Math.abs(area.width) < 5 || Math.abs(area.height) < 5) {
                return { currentDrawingArea: null };
            }

            // Normalize rectangle
            const normalized: DesignArea = {
                id: Math.random().toString(36).substr(2, 9),
                productId: area.productId,
                x: area.width > 0 ? area.x : area.x + area.width,
                y: area.height > 0 ? area.y : area.y + area.height,
                width: Math.abs(area.width),
                height: Math.abs(area.height),
            };

            return {
                past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
                future: [],
                designAreas: [...state.designAreas, normalized],
                currentDrawingArea: null
            };
        });
    },

    finishOpening: () => {
        set((state) => {
            if (!state.currentDrawingArea || !('type' in state.currentDrawingArea)) return state;

            const area = state.currentDrawingArea as Opening;

            // Only add if it has some dimension
            if (Math.abs(area.width) < 5 || Math.abs(area.height) < 5) {
                return { currentDrawingArea: null };
            }

            // Normalize rectangle
            const normalized: Opening = {
                id: Math.random().toString(36).substr(2, 9),
                type: area.type,
                x: area.width > 0 ? area.x : area.x + area.width,
                y: area.height > 0 ? area.y : area.y + area.height,
                width: Math.abs(area.width),
                height: Math.abs(area.height),
            };

            return {
                past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
                future: [],
                openings: [...state.openings, normalized],
                currentDrawingArea: null
            };
        });
    },

    startList: (x, y) => {
        set({
            currentDrawingList: {
                id: 'temp',
                type: 'list',
                x1: x,
                y1: y,
                x2: x,
                y2: y
            }
        });
    },

    updateList: (x, y) => {
        set((state) => {
            if (!state.currentDrawingList) return state;
            return {
                currentDrawingList: {
                    ...state.currentDrawingList,
                    x2: x,
                    y2: y
                }
            };
        });
    },

    finishList: () => {
        set((state) => {
            if (!state.currentDrawingList) return state;

            const list = state.currentDrawingList;
            const length = Math.hypot(list.x2 - list.x1, list.y2 - list.y1);

            if (length < 5) {
                return { currentDrawingList: null };
            }

            const newList: ListElement = {
                ...list,
                id: Math.random().toString(36).substr(2, 9)
            };

            return {
                past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
                future: [],
                lists: [...state.lists, newList],
                currentDrawingList: null
            };
        });
    },

    removeList: (id) => {
        set((state) => ({
            past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
            future: [],
            lists: state.lists.filter(a => a.id !== id)
        }));
    },

    removeDesignArea: (id) => {
        set((state) => ({
            past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
            future: [],
            designAreas: state.designAreas.filter(a => a.id !== id)
        }));
    },

    removeOpening: (id) => {
        set((state) => ({
            past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
            future: [],
            openings: state.openings.filter(a => a.id !== id)
        }));
    },

    clearDesignAreas: () => set((state) => ({
        past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
        future: [],
        designAreas: [],
        openings: [],
        lists: []
    })),

    undo: () => {
        set((state) => {
            if (state.past.length === 0) return state;

            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, -1);

            return {
                past: newPast,
                future: [{ designAreas: state.designAreas, openings: state.openings, lists: state.lists }, ...state.future],
                designAreas: previous.designAreas,
                openings: previous.openings,
                lists: previous.lists
            };
        });
    },

    redo: () => {
        set((state) => {
            if (state.future.length === 0) return state;

            const next = state.future[0];
            const newFuture = state.future.slice(1);

            return {
                past: [...state.past, { designAreas: state.designAreas, openings: state.openings, lists: state.lists }],
                future: newFuture,
                designAreas: next.designAreas,
                openings: next.openings,
                lists: next.lists
            };
        });
    },

    getDimensions: () => {
        const { points, isClosed } = get();
        if (!isClosed || points.length < 3) return { area: 0, perimeter: 0 };
        return {
            area: polygonArea(points) / (SCALE * SCALE), // Convert px^2 to m^2
            perimeter: polygonPerimeter(points) / SCALE, // Convert px to m
        };
    }
}));
