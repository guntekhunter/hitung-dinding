import { create } from "zustand";
import { polygonPerimeter, polygonArea, Point, Rect, isRectInPolygon } from "../function/geometry";

export const SCALE = 100; // 100px = 1m (Increased for better dragging)
export const PANEL_WIDTH_METERS = 0.2; // 20cm

export type Product = {
    id: string;
    name: string;
    width: number; // in meters
    height: number; // in meters
    color: string;
    price: number; // in Rp
    countType?: 'area' | 'length';
    unitLength?: number; // meters per stick (for length-based)
};

export const PRODUCTS: Product[] = [
    { id: "wallpanel", name: "Wallpanel (15cm)", width: 0.15, height: 2.9, color: "rgba(14, 165, 233, 0.4)", price: 250000 },
    { id: "wallpanel30", name: "Wallpanel (30cm)", width: 0.30, height: 2.9, color: "rgba(2, 132, 199, 0.4)", price: 500000 },
    { id: "wallboard", name: "Wallboard (40cm)", width: 0.40, height: 2.9, color: "rgba(16, 185, 129, 0.4)", price: 350000 },
    { id: "wallboard60", name: "Wallboard (60cm)", width: 0.60, height: 2.9, color: "rgba(20, 184, 166, 0.4)", price: 525000 },
    { id: "uvboard", name: "UV Board (122cm)", width: 1.22, height: 2.9, color: "rgba(168, 85, 247, 0.4)", price: 1200000 },
    { id: "moulding", name: "Moulding (2.9m)", width: 0.05, height: 2.9, color: "rgba(244, 63, 94, 0.4)", price: 100000, countType: 'length', unitLength: 2.9 },
    { id: "moulding8", name: "Moulding 8cm", width: 0.08, height: 2.9, color: "rgba(245, 158, 11, 0.4)", price: 150000, countType: 'length', unitLength: 2.9 },
    { id: "moulding6", name: "Moulding 6cm", width: 0.06, height: 2.9, color: "rgba(132, 204, 22, 0.4)", price: 120000, countType: 'length', unitLength: 2.9 },
    { id: "moulding4", name: "Moulding 4cm", width: 0.04, height: 2.9, color: "rgba(6, 182, 212, 0.4)", price: 80000, countType: 'length', unitLength: 2.9 },
    { id: "moulding2-5", name: "Moulding 2.5cm", width: 0.025, height: 2.9, color: "rgba(99, 102, 241, 0.4)", price: 50000, countType: 'length', unitLength: 2.9 },
    { id: "list", name: "List (2.9m)", width: 0.02, height: 2.9, color: "rgba(139, 92, 246, 0.4)", price: 60000, countType: 'length', unitLength: 2.9 },
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
    productId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};

export type Wall = {
    id: string;
    name: string;
    points: Point[];
    isClosed: boolean;
    designAreas: DesignArea[];
    openings: Opening[];
    lists: ListElement[];
    isWallLocked: boolean;
};

type HistoryEntry = {
    walls: Wall[];
};

type CanvasState = {
    // Current editing state
    walls: Wall[];
    activeWallId: string | null;

    // Interaction mode
    interactionMode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list';

    // Product state
    selectedProductId: string;
    currentDrawingArea: DesignArea | Opening | null;
    currentDrawingList: ListElement | null;

    // Customer Info
    customerInfo: {
        name: string;
        phone: string;
        address: string;
    };
    setCustomerInfo: (info: { name: string, phone: string, address: string }) => void;

    // History
    past: HistoryEntry[];
    future: HistoryEntry[];

    // Actions
    addWall: () => void;
    removeWall: (id: string) => void;
    setActiveWall: (id: string) => void;
    updateWallName: (id: string, name: string) => void;

    // Wall specific actions
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
    getDimensions: (wallId?: string) => { area: number; perimeter: number };

    // Zoom and Pan
    zoom: number;
    offset: { x: number; y: number };
    setZoom: (zoom: number) => void;
    setOffset: (x: number, y: number) => void;

    // Wall Lock state
    toggleWallLock: () => void;

    // Waste Percentage
    wastePercentage: number;
    setWastePercentage: (waste: number) => void;

    // Internal
    _saveHistory: () => void;
};

const initialWall: Wall = {
    id: 'wall-1',
    name: 'Wall 1',
    points: [],
    isClosed: false,
    designAreas: [],
    openings: [],
    lists: [],
    isWallLocked: false,
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
    walls: [initialWall],
    activeWallId: 'wall-1',
    interactionMode: 'draw',
    selectedProductId: PRODUCTS[0].id,
    currentDrawingArea: null,
    currentDrawingList: null,
    past: [],
    future: [],

    // Zoom and Pan
    zoom: 1,
    offset: { x: 0, y: 0 },
    setZoom: (zoom: number) => set({ zoom }),
    setOffset: (x: number, y: number) => set({ offset: { x, y } }),

    wastePercentage: 10,
    setWastePercentage: (waste: number) => set({ wastePercentage: waste }),

    customerInfo: {
        name: "",
        phone: "",
        address: ""
    },
    setCustomerInfo: (info) => set({ customerInfo: info }),

    addWall: () => {
        const { walls } = get();
        const id = `wall-${Date.now()}`;
        const newWall: Wall = {
            id,
            name: `Wall ${walls.length + 1}`,
            points: [],
            isClosed: false,
            designAreas: [],
            openings: [],
            lists: [],
            isWallLocked: false,
        };
        get()._saveHistory();
        set({
            walls: [...walls, newWall],
            activeWallId: id,
            interactionMode: 'draw'
        });
    },

    removeWall: (id) => {
        const { walls, activeWallId } = get();
        if (walls.length <= 1) return; // Keep at least one wall
        get()._saveHistory();
        const newWalls = walls.filter(w => w.id !== id);
        let newActiveId = activeWallId;
        if (activeWallId === id) {
            newActiveId = newWalls[0].id;
        }
        set({ walls: newWalls, activeWallId: newActiveId });
    },

    setActiveWall: (id) => set({ activeWallId: id }),

    updateWallName: (id, name) => {
        set((state) => ({
            walls: state.walls.map(w => w.id === id ? { ...w, name } : w)
        }));
    },

    toggleWallLock: () => {
        const { activeWallId } = get();
        set((state) => ({
            walls: state.walls.map(w =>
                w.id === activeWallId ? { ...w, isWallLocked: !w.isWallLocked } : w
            )
        }));
    },

    // Internal helper to save state for undo/redo
    _saveHistory: () => {
        const { walls, past } = get();
        set({
            past: [...past, { walls: JSON.parse(JSON.stringify(walls)) }],
            future: [],
        });
    },

    addPoint: (x, y) => {
        const { walls, activeWallId } = get();
        const activeWall = walls.find(w => w.id === activeWallId);
        if (!activeWall || activeWall.isClosed) return;

        // Check if closing
        if (activeWall.points.length >= 3) {
            const first = activeWall.points[0];
            const dist = Math.hypot(first.x - x, first.y - y);
            if (dist < 20) { // Snap to close
                get()._saveHistory();
                set({
                    walls: walls.map(w =>
                        w.id === activeWallId ? { ...w, isClosed: true } : w
                    ),
                    interactionMode: 'place'
                });
                return;
            }
        }
        get()._saveHistory();
        set({
            walls: walls.map(w =>
                w.id === activeWallId ? { ...w, points: [...w.points, { x, y }] } : w
            )
        });
    },

    updatePoint: (index, x, y) => {
        const { activeWallId } = get();
        set((state) => ({
            walls: state.walls.map(w =>
                w.id === activeWallId
                    ? { ...w, points: w.points.map((p, i) => i === index ? { x, y } : p) }
                    : w
            )
        }));
    },

    updateEdgeLength: (index, lengthMeters) => {
        const { activeWallId, walls } = get();
        const activeWall = walls.find(w => w.id === activeWallId);
        if (!activeWall) return;

        get()._saveHistory();
        set((state) => {
            const updatedWalls = state.walls.map(w => {
                if (w.id !== activeWallId) return w;

                const points = [...w.points];
                if (index >= points.length) return w;

                const p1 = points[index];
                const p2Index = (index + 1) % points.length;
                const p2 = points[p2Index];

                const currentLengthPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const targetLengthPx = lengthMeters * SCALE;

                if (currentLengthPx === 0) return w;

                const ratio = targetLengthPx / currentLengthPx;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;

                const newX = p1.x + dx * ratio;
                const newY = p1.y + dy * ratio;

                const deltaX = newX - p2.x;
                const deltaY = newY - p2.y;

                points[p2Index] = { x: newX, y: newY };

                if (index < points.length - 1) {
                    for (let i = index + 2; i < points.length; i++) {
                        points[i] = {
                            x: points[i].x + deltaX,
                            y: points[i].y + deltaY
                        };
                    }
                }
                return { ...w, points };
            });
            return { walls: updatedWalls };
        });
    },

    reset: () => {
        get()._saveHistory();
        set({
            walls: [initialWall],
            activeWallId: initialWall.id,
            interactionMode: 'draw',
            currentDrawingArea: null,
            currentDrawingList: null
        });
    },

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
            } as any
        });
    },

    updateOpening: (x, y) => get().updateDesignArea(x, y),

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
            if (Math.abs(area.width) < 5 || Math.abs(area.height) < 5) {
                return { currentDrawingArea: null };
            }

            const normalized: DesignArea = {
                id: Math.random().toString(36).substr(2, 9),
                productId: area.productId,
                x: area.width > 0 ? area.x : area.x + area.width,
                y: area.height > 0 ? area.y : area.y + area.height,
                width: Math.abs(area.width),
                height: Math.abs(area.height),
            };

            const updatedWalls = state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, designAreas: [...w.designAreas, normalized] }
                    : w
            );

            return {
                past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
                future: [],
                walls: updatedWalls,
                currentDrawingArea: null
            };
        });
    },

    finishOpening: () => {
        set((state) => {
            if (!state.currentDrawingArea || !('type' in state.currentDrawingArea)) return state;
            const area = state.currentDrawingArea as Opening;
            if (Math.abs(area.width) < 5 || Math.abs(area.height) < 5) {
                return { currentDrawingArea: null };
            }

            const normalized: Opening = {
                id: Math.random().toString(36).substr(2, 9),
                type: area.type,
                x: area.width > 0 ? area.x : area.x + area.width,
                y: area.height > 0 ? area.y : area.y + area.height,
                width: Math.abs(area.width),
                height: Math.abs(area.height),
            };

            const updatedWalls = state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, openings: [...w.openings, normalized] }
                    : w
            );

            return {
                past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
                future: [],
                walls: updatedWalls,
                currentDrawingArea: null
            };
        });
    },

    startList: (x, y) => {
        const { selectedProductId } = get();
        set({
            currentDrawingList: {
                id: 'temp',
                type: 'list',
                productId: selectedProductId,
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
            if (length < 5) return { currentDrawingList: null };

            const newList: ListElement = {
                ...list,
                id: Math.random().toString(36).substr(2, 9)
            };

            const updatedWalls = state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, lists: [...w.lists, newList] }
                    : w
            );

            return {
                past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
                future: [],
                walls: updatedWalls,
                currentDrawingList: null
            };
        });
    },

    removeList: (id) => {
        set((state) => ({
            past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
            future: [],
            walls: state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, lists: w.lists.filter(l => l.id !== id) }
                    : w
            )
        }));
    },

    removeDesignArea: (id) => {
        set((state) => ({
            past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
            future: [],
            walls: state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, designAreas: w.designAreas.filter(a => a.id !== id) }
                    : w
            )
        }));
    },

    removeOpening: (id) => {
        set((state) => ({
            past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
            future: [],
            walls: state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, openings: w.openings.filter(o => o.id !== id) }
                    : w
            )
        }));
    },

    clearDesignAreas: () => {
        set((state) => ({
            past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
            future: [],
            walls: state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, designAreas: [], openings: [], lists: [] }
                    : w
            )
        }));
    },

    undo: () => {
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, -1);
            return {
                past: newPast,
                future: [{ walls: JSON.parse(JSON.stringify(state.walls)) }, ...state.future],
                walls: previous.walls,
            };
        });
    },

    redo: () => {
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const newFuture = state.future.slice(1);
            return {
                past: [...state.past, { walls: JSON.parse(JSON.stringify(state.walls)) }],
                future: newFuture,
                walls: next.walls,
            };
        });
    },

    getDimensions: (wallId) => {
        const { walls, activeWallId } = get();
        const id = wallId || activeWallId;
        const wall = walls.find(w => w.id === id);
        if (!wall || !wall.isClosed || wall.points.length < 3) return { area: 0, perimeter: 0 };
        return {
            area: polygonArea(wall.points) / (SCALE * SCALE),
            perimeter: polygonPerimeter(wall.points) / SCALE,
        };
    }
}));
