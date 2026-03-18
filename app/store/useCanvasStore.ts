import { create } from "zustand";
import { polygonPerimeter, polygonArea, Point, Rect, isRectInPolygon } from "../function/geometry";

export const SCALE = 100; // 100px = 1m (Increased for better dragging)
export const PANEL_WIDTH_METERS = 0.2; // 20cm

export type Product = {
    id: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    unitLength: number | null; // unit_length in db
    height: number | null;
    width: number | null;
    color: string;
    countType: 'area' | 'length'; // count_type in db
};

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

    // Products from database
    products: Product[];
    isLoadingProducts: boolean;
    fetchProducts: () => Promise<void>;

    // Interaction mode
    interactionMode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list' | 'pan';

    // Product state
    selectedProductId: string;
    currentDrawingArea: DesignArea | Opening | null;
    currentDrawingList: ListElement | null;

    // Customer Info
    customerInfo: {
        name: string;
        phone: string;
        address: string;
        surveyorName: string;
    };
    setCustomerInfo: (info: { name: string, phone: string, address: string, surveyorName: string }) => void;

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
    setInteractionMode: (mode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list' | 'pan') => void;

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

    // Gap for Moulding
    mouldingGap: number; // in meters
    setMouldingGap: (gap: number) => void;

    // Material Prices
    materialPrices: Record<string, number>;
    setMaterialPrice: (productId: string, price: number) => void;

    // Moulding Drawing Mode
    listDrawingType: 'line' | 'rectangle';
    setListDrawingType: (type: 'line' | 'rectangle') => void;

    // Database ID
    projectId: string | null;
    setProjectId: (id: string | null) => void;
    loadProject: (id: string, data: any) => void;

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
    products: [],
    isLoadingProducts: false,
    interactionMode: 'draw',
    selectedProductId: '',
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

    mouldingGap: 0.1, // Default 10cm
    setMouldingGap: (gap: number) => set({ mouldingGap: gap }),

    fetchProducts: async () => {
        set({ isLoadingProducts: true });
        try {
            const res = await fetch("/api/materials");
            const data = await res.json();
            if (Array.isArray(data)) {
                // Map database fields to Product type
                const mappedProducts: Product[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    unit: item.unit,
                    price: item.price || 0,
                    unitLength: item.unit_length,
                    height: item.height,
                    width: item.width,
                    color: item.color,
                    countType: item.count_type as 'area' | 'length'
                }));
                
                set({ 
                    products: mappedProducts,
                    materialPrices: mappedProducts.reduce((acc, p) => ({ ...acc, [p.id]: p.price }), {})
                });

                // Auto-select first product if none selected
                if (!get().selectedProductId && mappedProducts.length > 0) {
                    set({ selectedProductId: mappedProducts[0].id });
                }
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            set({ isLoadingProducts: false });
        }
    },

    customerInfo: {
        name: "",
        phone: "",
        address: "",
        surveyorName: ""
    },
    materialPrices: {},

    setMaterialPrice: (productId, price) => set((state) => ({
        materialPrices: { ...state.materialPrices, [productId]: price }
    })),

    listDrawingType: 'line',
    setListDrawingType: (type) => set({ listDrawingType: type }),

    projectId: null,
    setProjectId: (id) => set({ projectId: id }),

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
            currentDrawingList: null,
            projectId: null
        });
    },

    loadProject: (id: string, data: any) => {
        get()._saveHistory();
        const loadedWalls = data?.canvas?.walls || [initialWall];
        set({
            projectId: id,
            customerInfo: {
                name: data?.projectInfo?.customerName || "",
                phone: data?.projectInfo?.phone || "",
                address: data?.projectInfo?.address || "",
                surveyorName: data?.projectInfo?.surveyor || ""
            },
            walls: loadedWalls,
            activeWallId: loadedWalls[0]?.id || initialWall.id,
            interactionMode: 'draw',
            currentDrawingArea: null,
            currentDrawingList: null
        });
    },

    setSelectedProduct: (id) => set({ selectedProductId: id }),
    setInteractionMode: (mode: 'draw' | 'place' | 'delete' | 'window' | 'door' | 'list' | 'pan') => set({ interactionMode: mode }),

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

            const newLists: ListElement[] = [];
            if (state.listDrawingType === 'line') {
                newLists.push({
                    ...list,
                    id: Math.random().toString(36).substr(2, 9)
                });
            } else {
                // Rectangle: 4 segments
                const points = [
                    { x: list.x1, y: list.y1 },
                    { x: list.x2, y: list.y1 },
                    { x: list.x2, y: list.y2 },
                    { x: list.x1, y: list.y2 }
                ];
                for (let i = 0; i < 4; i++) {
                    const p1 = points[i];
                    const p2 = points[(i + 1) % 4];
                    newLists.push({
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'list',
                        productId: list.productId,
                        x1: p1.x,
                        y1: p1.y,
                        x2: p2.x,
                        y2: p2.y
                    });
                }
            }

            const updatedWalls = state.walls.map(w =>
                w.id === state.activeWallId
                    ? { ...w, lists: [...w.lists, ...newLists] }
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
