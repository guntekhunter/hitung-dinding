'use client';
import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
export const dynamic = 'force-static';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import { useCanvasStore, SCALE, DesignArea, Product } from '../store/useCanvasStore';
import { usePathname } from 'next/navigation';

import { callWorker, warmupWorker } from '../utils/workerManager';

const useWorker = () => {
    const postMessage = useCallback((message: any) => {
        return callWorker(message.type, message.data);
    }, []);

    return postMessage;
};

const useCustomImage = (url: string) => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    useEffect(() => {
        if (!url || (!url.startsWith('data:image') && !url.startsWith('http'))) {
            setImage(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => setImage(img);
    }, [url]);
    return image;
};

interface WallEditorProps {
    wallId?: string;
    overrideZoom?: number;
    overrideOffset?: { x: number, y: number };
    readOnly?: boolean;
}

/** Renders a tiled texture image as the ceiling wall background fill */
const CeilingTextureRect = React.memo(({ clipFunc, bounds, textureUrl, panelWidth, panelHeight, direction }: {
    clipFunc: (ctx: any) => void;
    bounds: { minX: number; minY: number; width: number; height: number };
    textureUrl: string;
    panelWidth: number;
    panelHeight: number;
    direction: 'horizontal' | 'vertical';
}) => {
    const image = useCustomImage(textureUrl);
    if (!image) return null;

    const isPortrait = image.naturalHeight > image.naturalWidth;
    let rotation = 0;
    let scale = 1;

    if (direction === 'horizontal') {
        if (isPortrait) {
            rotation = 270;
            scale = panelWidth / image.naturalWidth;
        } else {
            rotation = 0;
            scale = panelWidth / image.naturalHeight;
        }
    } else {
        if (isPortrait) {
            rotation = 0;
            scale = panelWidth / image.naturalWidth;
        } else {
            rotation = 90;
            scale = panelWidth / image.naturalHeight;
        }
    }

    return (
        <Group clipFunc={clipFunc}>
            <Rect
                x={bounds.minX}
                y={bounds.minY}
                width={bounds.width}
                height={bounds.height}
                fillPatternImage={image}
                fillPatternRepeat="repeat"
                fillPatternScaleX={scale}
                fillPatternScaleY={scale}
                fillPatternRotation={rotation}
                listening={false}
            />
        </Group>
    );
});
CeilingTextureRect.displayName = 'CeilingTextureRect';

const WallEditor = forwardRef((props: WallEditorProps, ref) => {
    const stageRef = useRef<any>(null);
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const isPanningRef = useRef(false); // Using ref for panning to avoid re-renders during mouse move

    useImperativeHandle(ref, () => ({
        getStage: () => stageRef.current
    }));

    const lastDist = useRef<number>(0);
    const lastCenter = useRef<{ x: number, y: number } | null>(null);

    const {
        walls, activeWallId: storeActiveWallId, addPoint, updatePoint, updateEdgeLength,
        interactionMode, currentDrawingArea, currentDrawingList,
        startDesignArea, updateDesignArea, finishDesignArea, removeDesignArea,
        startOpening, updateOpening, finishOpening, removeOpening,
        startList, updateList, finishList, removeList,
        zoom: storeZoom, offset: storeOffset, setZoom, setOffset,
        undo, redo, mouldingGap, listDrawingType, setListDrawingType,
        products, isExporting, isColoringPreview,
        selectedDesignAreaId, setSelectedDesignAreaId,
        selectedWallId, setSelectedWallId
    } = useCanvasStore();

    const activeWallId = props.wallId || storeActiveWallId;
    const zoom = props.overrideZoom !== undefined ? props.overrideZoom : storeZoom;
    const offset = props.overrideOffset !== undefined ? props.overrideOffset : storeOffset;

    const pathname = usePathname();
    const isColoringMode = pathname === '/coloring' || isColoringPreview;
    const shouldHideText = isExporting || isColoringMode;

    const activeWall = walls.find(w => w.id === activeWallId) || walls[0];
    const {
        points, isClosed, designAreas, openings, lists, isWallLocked
    } = activeWall || {};

    // Interaction State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);

    const [mounted, setMounted] = useState(false);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic Text Scale: Text grows slightly as you zoom in
    const textScale = 1 / Math.pow(zoom, 0.7);

    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    useEffect(() => {
        const checkLayout = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setIsTablet(width >= 768 && width < 1024);
        };
        checkLayout();
        window.addEventListener('resize', checkLayout);
        return () => window.removeEventListener('resize', checkLayout);
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Measure container size AFTER mounted=true so the real container (with ref) is rendered
    useEffect(() => {
        if (!mounted) return;

        const handleResize = () => {
            if (containerRef.current) {
                setStageSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };

        // Use requestAnimationFrame to ensure layout is settled after mount
        const raf = requestAnimationFrame(handleResize);

        // ResizeObserver for reliable size tracking (handles parent size changes)
        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            observer = new ResizeObserver(handleResize);
            observer.observe(containerRef.current);
        }

        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', handleResize);
            if (observer) observer.disconnect();
        };
    }, [mounted]);

    useEffect(() => {
        warmupWorker().catch(() => { });
    }, []);

    useEffect(() => {
        if (editingIndex !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingIndex]);

    useEffect(() => {
        const handleKeyDownGlobal = (e: KeyboardEvent) => {
            // Don't undo/redo if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    e.preventDefault();
                } else if (e.key === 'y') {
                    redo();
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDownGlobal);
        return () => window.removeEventListener('keydown', handleKeyDownGlobal);
    }, [undo, redo]);

    const handleLabelClick = (index: number, currentLength: string) => {
        // Prevent editing while dragging points or not closed or locked
        if (!isClosed || isWallLocked) return;
        setEditingIndex(index);
        setInputValue(currentLength);
    };

    const handleInputCommit = () => {
        if (editingIndex !== null) {
            const val = parseFloat(inputValue);
            if (!isNaN(val) && val > 0) {
                updateEdgeLength(editingIndex, val);
            }
            setEditingIndex(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleInputCommit();
        if (e.key === 'Escape') setEditingIndex(null);
    };

    const SNAP_THRESHOLD = 20 / zoom; // Adjust snap threshold based on zoom

    const allSegments = useMemo(() => {
        const segs: { p1: { x: number; y: number }; p2: { x: number; y: number } }[] = [];
        // Wall edges
        if (points.length >= 2) {
            for (let i = 0; i < points.length; i++) {
                if (i === points.length - 1 && !isClosed) break;
                segs.push({ p1: points[i], p2: points[(i + 1) % points.length] });
            }
        }
        // Other mouldings
        lists.forEach(l => {
            segs.push({ p1: { x: l.x1, y: l.y1 }, p2: { x: l.x2, y: l.y2 } });
        });
        // Design Areas
        designAreas.forEach(a => {
            segs.push({ p1: { x: a.x, y: a.y }, p2: { x: a.x + a.width, y: a.y } });
            segs.push({ p1: { x: a.x + a.width, y: a.y }, p2: { x: a.x + a.width, y: a.y + a.height } });
            segs.push({ p1: { x: a.x + a.width, y: a.y + a.height }, p2: { x: a.x, y: a.y + a.height } });
            segs.push({ p1: { x: a.x, y: a.y + a.height }, p2: { x: a.x, y: a.y } });
        });
        // Openings
        openings.forEach(o => {
            segs.push({ p1: { x: o.x, y: o.y }, p2: { x: o.x + o.width, y: o.y } });
            segs.push({ p1: { x: o.x + o.width, y: o.y }, p2: { x: o.x + o.width, y: o.y + o.height } });
            segs.push({ p1: { x: o.x + o.width, y: o.y + o.height }, p2: { x: o.x, y: o.y + o.height } });
            segs.push({ p1: { x: o.x, y: o.y + o.height }, p2: { x: o.x, y: o.y } });
        });
        return segs;
    }, [points, isClosed, lists, designAreas, openings]);

    const snapToGap = (pos: { x: number; y: number }, useGap: boolean = true, customGapPx?: number) => {
        let snappedX = pos.x;
        let snappedY = pos.y;
        const gapPx = customGapPx !== undefined ? customGapPx : (useGap ? mouldingGap * SCALE : 0);

        allSegments.forEach(seg => {
            // Is it vertical?
            if (Math.abs(seg.p1.x - seg.p2.x) < 0.1) {
                const x = seg.p1.x;
                const yMin = Math.min(seg.p1.y, seg.p2.y);
                const yMax = Math.max(seg.p1.y, seg.p2.y);
                if (pos.y >= yMin - 10 && pos.y <= yMax + 10) {
                    if (useGap) {
                        if (Math.abs(pos.x - (x - gapPx)) < SNAP_THRESHOLD) snappedX = x - gapPx;
                        if (Math.abs(pos.x - (x + gapPx)) < SNAP_THRESHOLD) snappedX = x + gapPx;
                    } else {
                        if (Math.abs(pos.x - x) < SNAP_THRESHOLD) snappedX = x;
                    }
                }
            }
            // Is it horizontal?
            else if (Math.abs(seg.p1.y - seg.p2.y) < 0.1) {
                const y = seg.p1.y;
                const xMin = Math.min(seg.p1.x, seg.p2.x);
                const xMax = Math.max(seg.p1.x, seg.p2.x);
                if (pos.x >= xMin - 10 && pos.x <= xMax + 10) {
                    if (useGap) {
                        if (Math.abs(pos.y - (y - gapPx)) < SNAP_THRESHOLD) snappedY = y - gapPx;
                        if (Math.abs(pos.y - (y + gapPx)) < SNAP_THRESHOLD) snappedY = y + gapPx;
                    } else {
                        if (Math.abs(pos.y - y) < SNAP_THRESHOLD) snappedY = y;
                    }
                }
            }
        });

        return { x: snappedX, y: snappedY };
    };

    // Flatten points for Konva Line [x1, y1, x2, y2...]
    const flattenedPoints = points.flatMap(p => [p.x, p.y]);

    // 1. Calculate Bounding Box
    const bounds = useMemo(() => {
        if (points.length < 2) return { minX: 0, minY: 0, width: 0, height: 0 };
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return {
            minX, minY,
            width: Math.max(...xs) - minX,
            height: Math.max(...ys) - minY
        };
    }, [points]);

    const snapKotakMode = (pos: { x: number; y: number }, gapPx: number) => {
        let snappedX = pos.x;
        let snappedY = pos.y;

        const wallCenter = {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        };

        // --- 1. EXISTING MOULDING ALIGNMENT & SNAPPING (Highest Snapping Priority) ---
        let snappedToMouldingX = false;
        let snappedToMouldingY = false;

        lists.forEach((l: any) => {
            // Vertical segment alignment
            if (Math.abs(l.x1 - l.x2) < 0.1) {
                const mouldingX = l.x1;
                // Priority 1: Snap to exact same vertical line (in-line alignment)
                if (Math.abs(pos.x - mouldingX) < SNAP_THRESHOLD) {
                    snappedX = mouldingX;
                    snappedToMouldingX = true;
                }
                // Priority 2: Snap to other side (gapPx gap)
                else if (Math.abs(pos.x - (mouldingX - gapPx)) < SNAP_THRESHOLD) {
                    snappedX = mouldingX - gapPx;
                    snappedToMouldingX = true;
                }
                else if (Math.abs(pos.x - (mouldingX + gapPx)) < SNAP_THRESHOLD) {
                    snappedX = mouldingX + gapPx;
                    snappedToMouldingX = true;
                }
            }
            // Horizontal segment alignment
            if (Math.abs(l.y1 - l.y2) < 0.1) {
                const mouldingY = l.y1;
                // Priority 1: Snap to exact same horizontal line (in-line alignment)
                if (Math.abs(pos.y - mouldingY) < SNAP_THRESHOLD) {
                    snappedY = mouldingY;
                    snappedToMouldingY = true;
                }
                // Priority 2: Snap to other side (gapPx gap)
                else if (Math.abs(pos.y - (mouldingY - gapPx)) < SNAP_THRESHOLD) {
                    snappedY = mouldingY - gapPx;
                    snappedToMouldingY = true;
                }
                else if (Math.abs(pos.y - (mouldingY + gapPx)) < SNAP_THRESHOLD) {
                    snappedY = mouldingY + gapPx;
                    snappedToMouldingY = true;
                }
            }
        });

        // --- 2. EXISTING MOULDING NO-TOUCH CLAMPING (Enforce 10cm gap if X/Y ranges overlap) ---
        const startX = currentDrawingList ? currentDrawingList.x1 : pos.x;
        const startY = currentDrawingList ? currentDrawingList.y1 : pos.y;
        const newXMin = Math.min(startX, pos.x);
        const newXMax = Math.max(startX, pos.x);
        const newYMin = Math.min(startY, pos.y);
        const newYMax = Math.max(startY, pos.y);

        lists.forEach((l: any) => {
            // Vertical moulding segment (keeps horizontal gap)
            if (Math.abs(l.x1 - l.x2) < 0.1) {
                const mouldingX = l.x1;
                const existYMin = Math.min(l.y1, l.y2);
                const existYMax = Math.max(l.y1, l.y2);

                // If Y ranges overlap, enforce the gapPx horizontal distance
                if (newYMin - 5 <= existYMax && newYMax + 5 >= existYMin) {
                    if (pos.x < mouldingX) {
                        snappedX = Math.min(snappedX, mouldingX - gapPx);
                    } else if (pos.x > mouldingX) {
                        snappedX = Math.max(snappedX, mouldingX + gapPx);
                    }
                }
            }

            // Horizontal moulding segment (keeps vertical gap)
            if (Math.abs(l.y1 - l.y2) < 0.1) {
                const mouldingY = l.y1;
                const existXMin = Math.min(l.x1, l.x2);
                const existXMax = Math.max(l.x1, l.x2);

                // If X ranges overlap, enforce the gapPx vertical distance
                if (newXMin - 5 <= existXMax && newXMax + 5 >= existXMin) {
                    if (pos.y < mouldingY) {
                        snappedY = Math.min(snappedY, mouldingY - gapPx);
                    } else if (pos.y > mouldingY) {
                        snappedY = Math.max(snappedY, mouldingY + gapPx);
                    }
                }
            }
        });

        // --- 3. WALL BOUNDARY CLAMPING & SNAPPING (Only snap to wall line if not already snapped to moulding) ---
        const horizontalWallLines: number[] = [];
        const verticalWallLines: number[] = [];
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            if (Math.abs(p1.x - p2.x) < 0.1) {
                verticalWallLines.push(p1.x);
            }
            if (Math.abs(p1.y - p2.y) < 0.1) {
                horizontalWallLines.push(p1.y);
            }
        }

        if (verticalWallLines.length > 0) {
            let closestVertWallX = verticalWallLines[0];
            let minDistX = Infinity;
            verticalWallLines.forEach(wallX => {
                const dist = Math.abs(pos.x - wallX);
                if (dist < minDistX) {
                    minDistX = dist;
                    closestVertWallX = wallX;
                }
            });

            // Boundary snap (only if not already aligned to a moulding line)
            if (!snappedToMouldingX) {
                if (closestVertWallX < wallCenter.x) {
                    if (pos.x < closestVertWallX + gapPx + SNAP_THRESHOLD) {
                        snappedX = closestVertWallX + gapPx;
                    }
                } else {
                    if (pos.x > closestVertWallX - gapPx - SNAP_THRESHOLD) {
                        snappedX = closestVertWallX - gapPx;
                    }
                }
            }

            // Strict Safety Clamping (always active to prevent crossing outside the 10cm margin)
            if (closestVertWallX < wallCenter.x) {
                snappedX = Math.max(snappedX, closestVertWallX + gapPx);
            } else {
                snappedX = Math.min(snappedX, closestVertWallX - gapPx);
            }
        }

        if (horizontalWallLines.length > 0) {
            let closestHorizWallY = horizontalWallLines[0];
            let minDistY = Infinity;
            horizontalWallLines.forEach(wallY => {
                const dist = Math.abs(pos.y - wallY);
                if (dist < minDistY) {
                    minDistY = dist;
                    closestHorizWallY = wallY;
                }
            });

            // Boundary snap (only if not already aligned to a moulding line)
            if (!snappedToMouldingY) {
                if (closestHorizWallY < wallCenter.y) {
                    if (pos.y < closestHorizWallY + gapPx + SNAP_THRESHOLD) {
                        snappedY = closestHorizWallY + gapPx;
                    }
                } else {
                    if (pos.y > closestHorizWallY - gapPx - SNAP_THRESHOLD) {
                        snappedY = closestHorizWallY - gapPx;
                    }
                }
            }

            // Strict Safety Clamping (always active to prevent crossing outside the 10cm margin)
            if (closestHorizWallY < wallCenter.y) {
                snappedY = Math.max(snappedY, closestHorizWallY + gapPx);
            } else {
                snappedY = Math.min(snappedY, closestHorizWallY - gapPx);
            }
        }

        return { x: snappedX, y: snappedY };
    };

    // 2. Define the Clipping Function based on the drawn polygon
    const clipFunc = React.useCallback((ctx: any) => {
        if (points.length < 3 || !isClosed) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
    }, [points, isClosed]);

    // 3. Generate the Panels Visual
    const MemoizedAreaDimensions = React.memo(({ area, zoom, textScale, points, isExporting }: any) => {
        if (isExporting) return null;

        const absWidth = Math.abs(area.width);
        const absHeight = Math.abs(area.height);
        const dimOffset = 20 / zoom;
        const tickLen = 4 / zoom;

        const maxY = points && points.length > 0 ? Math.max(...points.map((p: any) => p.y)) : area.y + area.height;
        const bottomY = maxY - area.y + dimOffset;
        // Height dimension goes to the right of the panel
        const rightX = area.width + dimOffset;

        return (
            <Group x={area.x} y={area.y} listening={false}>
                {/* Width below the panel */}
                <Group y={bottomY}>
                    <Line points={[0, 0, area.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[0, tickLen, 0, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[area.width, tickLen, area.width, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absWidth / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={area.width / 2} y={-12 / zoom} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
                {/* Height to the right of the panel */}
                <Group x={rightX}>
                    <Line points={[0, 0, 0, area.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, 0, tickLen, 0]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[-tickLen, area.height, tickLen, area.height]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absHeight / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={14 / zoom} y={area.height / 2} rotation={90} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
            </Group>
        );
    });

    const MemoizedOpeningDimensions = React.memo(({ opening, zoom, textScale, isExporting }: any) => {
        if (isExporting) return null;

        const absWidth = Math.abs(opening.width);
        const absHeight = Math.abs(opening.height);
        // Place dimensions ABOVE and to the LEFT so they never collide with
        // wall panel dimensions which go below and to the right
        const dimOffset = 16 / zoom;
        const tickLen = 4 / zoom;
        const topY = -dimOffset;       // above the opening
        const leftX = -dimOffset;      // left of the opening

        return (
            <Group x={opening.x} y={opening.y} listening={false}>
                {/* Width above the opening */}
                <Group y={topY}>
                    <Line points={[0, 0, opening.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[0, tickLen, 0, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[opening.width, tickLen, opening.width, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absWidth / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={opening.width / 2} y={14 / zoom} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
                {/* Height to the left of the opening */}
                <Group x={leftX}>
                    <Line points={[0, 0, 0, opening.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, 0, tickLen, 0]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[-tickLen, opening.height, tickLen, opening.height]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absHeight / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={-14 / zoom} y={opening.height / 2} rotation={-90} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
            </Group>
        );
    });

    // Gap Dimensions: distance from opening edges to wall boundary
    const MemoizedOpeningGapDimensions = React.memo(({ opening, zoom, textScale, points, isExporting }: any) => {
        if (isExporting) return null;
        if (!points || points.length < 3) return null;

        const xs: number[] = points.map((p: any) => p.x);
        const ys: number[] = points.map((p: any) => p.y);
        const wallMinX = Math.min(...xs);
        const wallMaxX = Math.max(...xs);
        const wallMinY = Math.min(...ys);
        const wallMaxY = Math.max(...ys);

        const openLeft = opening.x;
        const openRight = opening.x + opening.width;
        const openTop = opening.y;
        const openBottom = opening.y + opening.height;

        const gapLeft = openLeft - wallMinX;
        const gapRight = wallMaxX - openRight;
        const gapTop = openTop - wallMinY;
        const gapBottom = wallMaxY - openBottom;

        const tickLen = 4 / zoom;
        const labelOff = 6 / zoom;
        const lineColor = "#0ea5e9"; // sky-500
        const textColor = "#0369a1"; // sky-700
        const sw = 0.8 / zoom;
        const swT = 1 / zoom;

        // Vertical center of the opening for left/right gap lines
        const midY = opening.y + opening.height / 2;
        // Horizontal center for top/bottom gap lines
        const midX = opening.x + opening.width / 2;

        return (
            <Group listening={false}>
                {/* Left gap: wallMinX → opening.x, drawn at midY */}
                {gapLeft > 2 && (
                    <Group y={midY}>
                        <Line points={[wallMinX, 0, openLeft, 0]} stroke={lineColor} strokeWidth={sw} dash={[4 / zoom, 3 / zoom]} />
                        <Line points={[wallMinX, -tickLen, wallMinX, tickLen]} stroke={lineColor} strokeWidth={swT} />
                        <Line points={[openLeft, -tickLen, openLeft, tickLen]} stroke={lineColor} strokeWidth={swT} />
                        <Text
                            text={`${(gapLeft / SCALE).toFixed(2)}m`}
                            fontSize={9}
                            fill={textColor}
                            fontStyle="bold"
                            x={(wallMinX + openLeft) / 2}
                            y={-labelOff - 9 / zoom}
                            offsetX={15}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    </Group>
                )}
                {/* Right gap: openRight → wallMaxX, drawn at midY */}
                {gapRight > 2 && (
                    <Group y={midY}>
                        <Line points={[openRight, 0, wallMaxX, 0]} stroke={lineColor} strokeWidth={sw} dash={[4 / zoom, 3 / zoom]} />
                        <Line points={[openRight, -tickLen, openRight, tickLen]} stroke={lineColor} strokeWidth={swT} />
                        <Line points={[wallMaxX, -tickLen, wallMaxX, tickLen]} stroke={lineColor} strokeWidth={swT} />
                        <Text
                            text={`${(gapRight / SCALE).toFixed(2)}m`}
                            fontSize={9}
                            fill={textColor}
                            fontStyle="bold"
                            x={(openRight + wallMaxX) / 2}
                            y={-labelOff - 9 / zoom}
                            offsetX={15}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    </Group>
                )}
                {/* Top gap: wallMinY → openTop, drawn at midX */}
                {gapTop > 2 && (
                    <Group x={midX}>
                        <Line points={[0, wallMinY, 0, openTop]} stroke={lineColor} strokeWidth={sw} dash={[4 / zoom, 3 / zoom]} />
                        <Line points={[-tickLen, wallMinY, tickLen, wallMinY]} stroke={lineColor} strokeWidth={swT} />
                        <Line points={[-tickLen, openTop, tickLen, openTop]} stroke={lineColor} strokeWidth={swT} />
                        <Text
                            text={`${(gapTop / SCALE).toFixed(2)}m`}
                            fontSize={9}
                            fill={textColor}
                            fontStyle="bold"
                            x={labelOff}
                            y={(wallMinY + openTop) / 2}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    </Group>
                )}
                {/* Bottom gap: openBottom → wallMaxY, drawn at midX */}
                {gapBottom > 2 && (
                    <Group x={midX}>
                        <Line points={[0, openBottom, 0, wallMaxY]} stroke={lineColor} strokeWidth={sw} dash={[4 / zoom, 3 / zoom]} />
                        <Line points={[-tickLen, openBottom, tickLen, openBottom]} stroke={lineColor} strokeWidth={swT} />
                        <Line points={[-tickLen, wallMaxY, tickLen, wallMaxY]} stroke={lineColor} strokeWidth={swT} />
                        <Text
                            text={`${(gapBottom / SCALE).toFixed(2)}m`}
                            fontSize={9}
                            fill={textColor}
                            fontStyle="bold"
                            x={labelOff}
                            y={(openBottom + wallMaxY) / 2}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    </Group>
                )}
            </Group>
        );
    });

    // 4. Generate the Panels Content
    const MemoizedAreaContent = React.memo(({ area, product, zoom, textScale, onClick, points, onMove, onSaveHistory, wallCenter, interactionMode, isExporting, isColoringMode, customColor, readOnly, selectedDesignAreaId, setSelectedDesignAreaId, wallId, selectedWallId, setSelectedWallId }: any) => {
        const [asyncAreaM2, setAsyncAreaM2] = useState<number | null>(null);
        const calculateArea = useWorker();

        useEffect(() => {
            let isCurrent = true;
            let timeoutId: NodeJS.Timeout;

            const runCalc = async () => {
                const result: any = await calculateArea({
                    type: 'CALCULATE_AREA_INTERSECTION',
                    data: { polygon: points, rect: area }
                });
                if (isCurrent && result?.type === 'AREA_INTERSECTION_RESULT') {
                    setAsyncAreaM2(result.area / (SCALE * SCALE));
                }
            };

            timeoutId = setTimeout(() => {
                runCalc();
            }, 200);

            return () => {
                isCurrent = false;
                clearTimeout(timeoutId);
            };
        }, [area, points, calculateArea]);

        const panelWidthPx = (product.width || 0) * SCALE;
        const panelHeightPx = (product.height || 0) * SCALE;

        const horizontalCount = Math.ceil(Math.abs(area.width) / panelWidthPx);
        const verticalCount = Math.ceil(Math.abs(area.height) / panelHeightPx);

        const areaM2 = asyncAreaM2 !== null ? asyncAreaM2 : 0;
        const productAreaM2 = (product.width || 0) * (product.height || 0);
        const wastePercentage = useCanvasStore.getState().wastePercentage;
        const count = Math.ceil((areaM2 / (productAreaM2 || 1)) * (1 + wastePercentage / 100));

        const lines = useMemo(() => {
            const result = [];
            const startX = Math.min(0, area.width);
            for (let i = 1; i < horizontalCount; i++) {
                const x = startX + i * panelWidthPx;
                result.push(
                    <Line
                        key={`vline-${i}`}
                        points={[x, 0, x, area.height]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={1 / zoom}
                        dash={[5 / zoom, 5 / zoom]}
                    />
                );
            }
            const startY = Math.max(0, area.height);
            for (let i = 1; i < verticalCount; i++) {
                const y = startY - i * panelHeightPx;
                result.push(
                    <Line
                        key={`hline-${i}`}
                        points={[0, y, area.width, y]}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth={1 / zoom}
                        dash={[5 / zoom, 5 / zoom]}
                    />
                );
            }
            return result;
        }, [horizontalCount, verticalCount, area.width, area.height, panelWidthPx, panelHeightPx, zoom]);

        const color = product.color.replace('0.4', '1');
        const absWidth = Math.abs(area.width);
        const absHeight = Math.abs(area.height);

        // Custom per-area color overrides the product-level color
        const effectiveColor = customColor || product.color;
        const patternImage = useCustomImage(effectiveColor);
        const isPattern = !!patternImage;
        const isSelected = selectedDesignAreaId === area.id;
        const isWallSelected = selectedWallId === wallId;

        const handleClick = () => {
            if (readOnly && setSelectedDesignAreaId) {
                // Select this specific rectangle AND activate its wall
                setSelectedDesignAreaId(isSelected ? null : area.id);
                if (setSelectedWallId) {
                    setSelectedWallId(wallId || null);
                }
            } else {
                onClick();
            }
        };

        return (
            <Group
                x={area.x}
                y={area.y}
                draggable={!readOnly && interactionMode !== 'list'}
                onDragMove={readOnly ? undefined : (e) => {
                    let newX = e.target.x();
                    let newY = e.target.y();
                    const areaCenterX = newX + area.width / 2;
                    const areaCenterY = newY + area.height / 2;
                    const SNAP_DIST = 20 / zoom;
                    if (Math.abs(areaCenterX - wallCenter.x) < SNAP_DIST) newX = wallCenter.x - area.width / 2;
                    if (Math.abs(areaCenterY - wallCenter.y) < SNAP_DIST) newY = wallCenter.y - area.height / 2;
                    e.target.x(newX);
                    e.target.y(newY);
                }}
                onDragEnd={readOnly ? undefined : (e) => {
                    onSaveHistory();
                    onMove(area.id, e.target.x(), e.target.y());
                }}
            >
                <Rect
                    name="design-area"
                    width={area.width}
                    height={area.height}
                    fill={isPattern ? undefined : (product.countType === 'length' || product.countType === 'meter' ? "transparent" : effectiveColor)}
                    fillPatternImage={isPattern ? patternImage : undefined}
                    fillPatternRepeat="repeat"
                    fillPatternScaleX={isPattern && patternImage ? panelWidthPx / patternImage.naturalWidth : 1}
                    fillPatternScaleY={isPattern && patternImage ? panelHeightPx / patternImage.naturalHeight : 1}
                    stroke={
                        isSelected
                            ? "#7B6DED"
                            : isWallSelected && readOnly
                                ? "#22c55e"
                                : (product.countType === 'length' || product.countType === 'meter')
                                    ? effectiveColor.replace('0.4', '1')
                                    : isColoringMode ? "transparent" : "#1e293b"
                    }
                    strokeWidth={
                        isSelected
                            ? 4 / zoom
                            : isWallSelected && readOnly
                                ? 2 / zoom
                                : (product.countType === 'length' || product.countType === 'meter')
                                    ? 2 / zoom
                                    : isColoringMode ? 0 : 1 / zoom
                    }
                    dash={isWallSelected && !isSelected && readOnly ? [6 / zoom, 3 / zoom] : undefined}
                    onClick={handleClick}
                    onTap={handleClick}
                    onMouseEnter={(e: any) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = readOnly ? 'pointer' : 'move';
                    }}
                    onMouseLeave={(e: any) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'default';
                    }}
                />
                {!isExporting && (
                    <Text
                        text={product.name}
                        fontSize={10}
                        fill="#1e293b"
                        fontStyle="bold"
                        x={5 / zoom}
                        y={5 / zoom}
                        width={area.width - 10 / zoom}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                )}
                {(product.countType !== 'length' && product.countType !== 'meter') && (
                    <Group clipFunc={(ctx) => ctx.rect(0, 0, area.width, area.height)}>
                        {!isExporting && lines}
                        {!isExporting && (
                            <Text
                                text={``}
                                fontSize={11}
                                fill="#1e293b"
                                fontStyle="bold"
                                x={area.width / 2}
                                y={area.height / 2}
                                offsetX={20}
                                scaleX={textScale}
                                scaleY={textScale}
                            />
                        )}
                    </Group>
                )}
            </Group>
        );
    });

    const MemoizedOpeningContent = React.memo(({ opening, zoom, textScale, onClick, onMove, onSaveHistory, wallCenter, interactionMode, isExporting }: any) => {
        const isWindow = opening.type === 'window';
        const color = "#ffffff";
        const label = isWindow ? "Window" : "Door";
        const absWidth = Math.abs(opening.width);
        const absHeight = Math.abs(opening.height);
        const dimOffset = 20 / zoom;
        const tickLen = 4 / zoom;

        return (
            <Group
                x={opening.x}
                y={opening.y}
                draggable={interactionMode !== 'list'}
                onDragMove={(e) => {
                    let newX = e.target.x();
                    let newY = e.target.y();

                    // Snap center of area to center of wall
                    const areaCenterX = newX + opening.width / 2;
                    const areaCenterY = newY + opening.height / 2;

                    const SNAP_DIST = 20 / zoom;

                    if (Math.abs(areaCenterX - wallCenter.x) < SNAP_DIST) {
                        newX = wallCenter.x - opening.width / 2;
                    }
                    if (Math.abs(areaCenterY - wallCenter.y) < SNAP_DIST) {
                        newY = wallCenter.y - opening.height / 2;
                    }

                    e.target.x(newX);
                    e.target.y(newY);
                }}
                onDragEnd={(e) => {
                    onSaveHistory();
                    onMove(opening.id, e.target.x(), e.target.y());
                }}
            >
                <Rect
                    width={opening.width}
                    height={opening.height}
                    fill={color}
                    onClick={onClick}
                    onTap={onClick}
                    onMouseEnter={(e: any) => {
                        const container = e.target.getStage().container();
                        container.style.cursor = 'move';
                    }}
                    onMouseLeave={(e: any) => {
                        const container = e.target.getStage().container();
                        container.style.cursor = isClosed ? 'default' : 'crosshair';
                    }}
                />
                {!isExporting && (
                    <Text text={label} fontSize={12} fill="#1e293b" fontStyle="bold" align="center" width={opening.width} y={opening.height / 2 - 12 / zoom} scaleX={textScale} scaleY={textScale} listening={false} />
                )}
            </Group>
        );
    });

    const MemoizedListContent = React.memo(({ list, product, zoom, textScale, onClick, isExporting }: any) => {
        const color = product?.color.replace('0.4', '1') || "#8b5cf6";
        const unitLength = product?.unitLength || 2.9;
        const dx = list.x2 - list.x1;
        const dy = list.y2 - list.y1;
        const lengthPx = Math.hypot(dx, dy);
        const lengthM = (lengthPx / SCALE).toFixed(2);
        const midX = (list.x1 + list.x2) / 2;
        const midY = (list.y1 + list.y2) / 2;
        const count = Math.ceil((lengthPx / SCALE) / unitLength);
        const angle = Math.atan2(dy, dx);

        const isMoulding = product?.category === 'moulding';
        const lineThickness = isMoulding && product?.width ? (product.width * SCALE) : (2 / zoom);

        return (
            <Group>
                <Line
                    points={[list.x1, list.y1, list.x2, list.y2]}
                    stroke={color}
                    strokeWidth={lineThickness}
                    onClick={onClick}
                    onTap={onClick}
                />
            </Group>
        );
    });

    const renderAreaContent = (area: DesignArea | any) => {
        if (!('productId' in area)) return null;
        const product = products.find(p => p.id === area.productId);
        if (!product) return null;
        return <MemoizedAreaContent
            area={area}
            product={product}
            zoom={zoom}
            textScale={textScale}
            points={points}
            interactionMode={interactionMode}
            isExporting={shouldHideText}
            isColoringMode={isColoringMode}
            customColor={area.customColor}
            readOnly={props.readOnly}
            selectedDesignAreaId={selectedDesignAreaId}
            setSelectedDesignAreaId={setSelectedDesignAreaId}
            selectedWallId={selectedWallId}
            setSelectedWallId={setSelectedWallId}
            wallId={activeWallId}
            onClick={() => interactionMode === 'delete' && removeDesignArea(area.id)}
        />;
    };

    const renderOpeningContent = (opening: any) => {
        if (!('type' in opening)) return null;
        return <MemoizedOpeningContent opening={opening} zoom={zoom} textScale={textScale} interactionMode={interactionMode} isExporting={shouldHideText} onClick={() => interactionMode === 'delete' && removeOpening(opening.id)} />;
    };

    const renderListContent = (list: any) => {
        const product = products.find(p => p.id === list.productId);
        return <MemoizedListContent list={list} product={product} zoom={zoom} textScale={textScale} isExporting={shouldHideText} onClick={() => interactionMode === 'delete' && removeList(list.id)} />;
    };

    const wallCenter = useMemo(() => ({
        x: bounds.minX + bounds.width / 2,
        y: bounds.minY + bounds.height / 2
    }), [bounds]);

    const renderedAreas = useMemo(() => {
        const moveDesignArea = useCanvasStore.getState().moveDesignArea;
        const moveOpening = useCanvasStore.getState().moveOpening;
        const _saveHistory = useCanvasStore.getState()._saveHistory;

        const allElements = [
            ...designAreas.map(area => ({ ...area, renderType: 'area' })),
            ...openings.map(op => ({ ...op, renderType: 'opening' })),
            ...lists.map(list => ({ ...list, renderType: 'list' }))
        ];

        allElements.sort((a, b) => ((a as any).createdAt || 0) - ((b as any).createdAt || 0));

        return (
            <Group>
                <Group clipFunc={clipFunc}>
                    {allElements.map(el => {
                        if (el.renderType === 'area') {
                            const area = el as any;
                            const product = products.find(p => p.id === area.productId);
                            if (!product) return null;
                            return (
                                <MemoizedAreaContent
                                    key={area.id}
                                    area={area}
                                    product={product}
                                    zoom={zoom}
                                    textScale={textScale}
                                    points={points}
                                    wallCenter={wallCenter}
                                    onMove={moveDesignArea}
                                    onSaveHistory={_saveHistory}
                                    interactionMode={interactionMode}
                                    isExporting={shouldHideText}
                                    isColoringMode={isColoringMode}
                                    customColor={area.customColor}
                                    readOnly={props.readOnly}
                                    selectedDesignAreaId={selectedDesignAreaId}
                                    selectedWallId={selectedWallId}
                                    setSelectedDesignAreaId={setSelectedDesignAreaId}
                                    setSelectedWallId={setSelectedWallId}
                                    wallId={activeWallId}
                                    onClick={() => {
                                        if (interactionMode === 'delete') {
                                            useCanvasStore.getState().removeDesignArea(area.id);
                                        }
                                    }}
                                />
                            );
                        } else if (el.renderType === 'opening') {
                            const op = el as any;
                            return (
                                <MemoizedOpeningContent
                                    key={op.id}
                                    opening={op}
                                    zoom={zoom}
                                    textScale={textScale}
                                    wallCenter={wallCenter}
                                    onMove={moveOpening}
                                    onSaveHistory={_saveHistory}
                                    interactionMode={interactionMode}
                                    isExporting={shouldHideText}
                                    onClick={() => {
                                        if (interactionMode === 'delete') {
                                            useCanvasStore.getState().removeOpening(op.id);
                                        }
                                    }}
                                />
                            );
                        } else if (el.renderType === 'list') {
                            const list = el as any;
                            return (
                                <React.Fragment key={list.id}>
                                    {renderListContent(list)}
                                </React.Fragment>
                            );
                        }
                        return null;
                    })}
                    {currentDrawingArea && (
                        'productId' in currentDrawingArea
                            ? renderAreaContent(currentDrawingArea)
                            : renderOpeningContent(currentDrawingArea)
                    )}
                    {currentDrawingList && (
                        listDrawingType === 'line' ? renderListContent(currentDrawingList) : (() => {
                            const minX = Math.min(currentDrawingList.x1, currentDrawingList.x2);
                            const minY = Math.min(currentDrawingList.y1, currentDrawingList.y2);
                            const w = Math.abs(currentDrawingList.x2 - currentDrawingList.x1);
                            const h = Math.abs(currentDrawingList.y2 - currentDrawingList.y1);
                            const dimOffset = 20 / zoom;
                            const tickLen = 4 / zoom;
                            return (
                                <Group x={minX} y={minY}>
                                    <Rect
                                        width={w}
                                        height={h}
                                        stroke="rgba(244, 63, 94, 0.8)"
                                        strokeWidth={2 / zoom}
                                        dash={[5 / zoom, 5 / zoom]}
                                    />
                                    <Group y={h + dimOffset}>
                                        <Line points={[0, 0, w, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                                        <Line points={[0, tickLen, 0, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                                        <Line points={[w, tickLen, w, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                                        <Text
                                            text={`${(w / SCALE).toFixed(2)}m`}
                                            fontSize={9}
                                            fill="#475569"
                                            x={w / 2}
                                            y={-12 / zoom}
                                            offsetX={15}
                                            scaleX={textScale}
                                            scaleY={textScale}
                                        />
                                    </Group>
                                    <Group x={w + dimOffset}>
                                        <Line points={[0, 0, 0, h]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                                        <Line points={[-tickLen, 0, tickLen, 0]} stroke="#64748b" strokeWidth={1 / zoom} />
                                        <Line points={[-tickLen, h, tickLen, h]} stroke="#64748b" strokeWidth={1 / zoom} />
                                        <Text
                                            text={`${(h / SCALE).toFixed(2)}m`}
                                            fontSize={9}
                                            fill="#475569"
                                            x={14 / zoom}
                                            y={h / 2}
                                            rotation={90}
                                            offsetX={15}
                                            scaleX={textScale}
                                            scaleY={textScale}
                                        />
                                    </Group>
                                </Group>
                            );
                        })()
                    )}
                </Group>

                {/* Draw unclipped dimensions */}
                {allElements.map(el => {
                    if (el.renderType === 'area') {
                        return <MemoizedAreaDimensions key={`dim-${el.id}`} area={el} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />;
                    } else if (el.renderType === 'opening') {
                        return (
                            <React.Fragment key={`dim-${el.id}`}>
                                <MemoizedOpeningDimensions opening={el} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />
                                <MemoizedOpeningGapDimensions opening={el} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />
                            </React.Fragment>
                        );
                    }
                    return null;
                })}
                {currentDrawingArea && 'productId' in currentDrawingArea && (
                    <MemoizedAreaDimensions area={currentDrawingArea} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />
                )}
                {currentDrawingArea && !('productId' in currentDrawingArea) && (
                    <React.Fragment>
                        <MemoizedOpeningDimensions opening={currentDrawingArea} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />
                        <MemoizedOpeningGapDimensions opening={currentDrawingArea} zoom={zoom} textScale={textScale} points={points} isExporting={shouldHideText} />
                    </React.Fragment>
                )}
            </Group>
        );
    }, [
        designAreas, openings, lists, currentDrawingArea, currentDrawingList,
        clipFunc, interactionMode, zoom, textScale, points, wallCenter, products,
        shouldHideText, isColoringMode, props.readOnly, activeWallId,
        selectedDesignAreaId, selectedWallId,
        setSelectedDesignAreaId, setSelectedWallId,
        listDrawingType, renderListContent, renderAreaContent, renderOpeningContent
    ]);

    const renderedMouldingDimensions = useMemo(() => {
        if (shouldHideText || lists.length === 0) return null;

        const TOLERANCE = 2; // px tolerance to consider same size/position

        // Maps: key -> { start, end, labels: {text, color}[] }
        // Horizontal: keyed by "xMin,xMax"
        // Vertical: keyed by "yMin,yMax"
        type DimGroup = { start: number; end: number; labels: { text: string; color: string }[] };
        const horizontalGroups = new Map<string, DimGroup>();
        const verticalGroups = new Map<string, DimGroup>();

        lists.forEach((list: any) => {
            const product = products.find(p => p.id === list.productId);
            if (!product) return;
            const color = product.color.replace('0.4', '1');
            const isMeter = product.countType === 'meter';
            const unitLength = product.unitLength || 2.9;

            const isHorizontal = Math.abs(list.y1 - list.y2) < 0.1;
            const isVertical = Math.abs(list.x1 - list.x2) < 0.1;

            if (isHorizontal) {
                const xMin = Math.min(list.x1, list.x2);
                const xMax = Math.max(list.x1, list.x2);
                const lengthPx = xMax - xMin;
                if (lengthPx < 1) return;
                const count = Math.ceil((lengthPx / SCALE) / unitLength);
                const textLabel = isMeter
                    ? `${(lengthPx / SCALE).toFixed(2)}m`
                    : `${(lengthPx / SCALE).toFixed(2)}m`;

                // find existing group with same range (within tolerance)
                let found = false;
                horizontalGroups.forEach((g, k) => {
                    if (!found && Math.abs(g.start - xMin) < TOLERANCE && Math.abs(g.end - xMax) < TOLERANCE) {
                        if (!g.labels.some(l => l.text === textLabel && l.color === color)) {
                            g.labels.push({ text: textLabel, color });
                        }
                        found = true;
                    }
                });
                if (!found) {
                    const key = `${Math.round(xMin)},${Math.round(xMax)}`;
                    horizontalGroups.set(key, { start: xMin, end: xMax, labels: [{ text: textLabel, color }] });
                }
            } else if (isVertical) {
                const yMin = Math.min(list.y1, list.y2);
                const yMax = Math.max(list.y1, list.y2);
                const lengthPx = yMax - yMin;
                if (lengthPx < 1) return;
                const count = Math.ceil((lengthPx / SCALE) / unitLength);
                const textLabel = isMeter
                    ? `${(lengthPx / SCALE).toFixed(2)}m`
                    : `${(lengthPx / SCALE).toFixed(2)}m`;

                let found = false;
                verticalGroups.forEach((g, k) => {
                    if (!found && Math.abs(g.start - yMin) < TOLERANCE && Math.abs(g.end - yMax) < TOLERANCE) {
                        if (!g.labels.some(l => l.text === textLabel && l.color === color)) {
                            g.labels.push({ text: textLabel, color });
                        }
                        found = true;
                    }
                });
                if (!found) {
                    const key = `${Math.round(yMin)},${Math.round(yMax)}`;
                    verticalGroups.set(key, { start: yMin, end: yMax, labels: [{ text: textLabel, color }] });
                }
            }
        });

        const spacing = 18 / zoom;
        const fontSize = 10;
        const tickLen = 4 / zoom;
        const elements: React.ReactNode[] = [];
        const TEXT_PADDING = 50 / zoom; // Padding to ensure text and lines don't overlap

        // Horizontal packing
        const hDims: { start: number, end: number, label: any, rowIndex?: number }[] = [];
        horizontalGroups.forEach((group) => {
            group.labels.forEach(label => {
                hDims.push({ start: group.start, end: group.end, label });
            });
        });

        // Sort by length (shorter dimensions closer to wall)
        hDims.sort((a, b) => (a.end - a.start) - (b.end - b.start));

        const hRows: { start: number, end: number }[][] = [];
        hDims.forEach(dim => {
            let placed = false;
            for (let r = 0; r < hRows.length; r++) {
                const row = hRows[r];
                const overlaps = row.some(existing => {
                    const lineOverlaps = (dim.start < existing.end - 1) && (dim.end > existing.start + 1);
                    const mid1 = (dim.start + dim.end) / 2;
                    const mid2 = (existing.start + existing.end) / 2;
                    const textOverlaps = Math.abs(mid1 - mid2) < TEXT_PADDING;
                    return lineOverlaps || textOverlaps;
                });
                if (!overlaps) {
                    row.push(dim);
                    dim.rowIndex = r;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                dim.rowIndex = hRows.length;
                hRows.push([dim]);
            }
        });

        hDims.forEach((dim, idx) => {
            const midX = (dim.start + dim.end) / 2;
            const rowIdx = dim.rowIndex || 0;
            const yPos = bounds.minY - (spacing * (rowIdx + 1));
            const lineY = yPos + 12 / zoom;
            elements.push(
                <Group key={`hdim-${dim.start}-${dim.end}-${idx}`} listening={false}>
                    <Line points={[dim.start, lineY, dim.end, lineY]} stroke="#94a3b8" strokeWidth={1 / zoom} />
                    <Line points={[dim.start, lineY + tickLen, dim.start, lineY - tickLen]} stroke="#94a3b8" strokeWidth={1.5 / zoom} />
                    <Line points={[dim.end, lineY + tickLen, dim.end, lineY - tickLen]} stroke="#94a3b8" strokeWidth={1.5 / zoom} />
                    <Text
                        x={midX}
                        y={yPos}
                        text={dim.label.text}
                        fontSize={fontSize}
                        fill={dim.label.color}
                        fontStyle="bold"
                        align="center"
                        offsetX={30}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>
            );
        });

        // Vertical packing
        const vDims: { start: number, end: number, label: any, colIndex?: number }[] = [];
        verticalGroups.forEach((group) => {
            group.labels.forEach(label => {
                vDims.push({ start: group.start, end: group.end, label });
            });
        });

        vDims.sort((a, b) => (a.end - a.start) - (b.end - b.start));
        const vCols: { start: number, end: number }[][] = [];

        vDims.forEach(dim => {
            let placed = false;
            for (let c = 0; c < vCols.length; c++) {
                const col = vCols[c];
                const overlaps = col.some(existing => {
                    const lineOverlaps = (dim.start < existing.end - 1) && (dim.end > existing.start + 1);
                    const mid1 = (dim.start + dim.end) / 2;
                    const mid2 = (existing.start + existing.end) / 2;
                    const textOverlaps = Math.abs(mid1 - mid2) < TEXT_PADDING;
                    return lineOverlaps || textOverlaps;
                });
                if (!overlaps) {
                    col.push(dim);
                    dim.colIndex = c;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                dim.colIndex = vCols.length;
                vCols.push([dim]);
            }
        });

        vDims.forEach((dim, idx) => {
            const midY = (dim.start + dim.end) / 2;
            const colIdx = dim.colIndex || 0;
            const xPos = bounds.minX - (spacing * (colIdx + 1));
            const lineX = xPos + 12 / zoom;
            elements.push(
                <Group key={`vdim-${dim.start}-${dim.end}-${idx}`} listening={false}>
                    <Line points={[lineX, dim.start, lineX, dim.end]} stroke="#94a3b8" strokeWidth={1 / zoom} />
                    <Line points={[lineX - tickLen, dim.start, lineX + tickLen, dim.start]} stroke="#94a3b8" strokeWidth={1.5 / zoom} />
                    <Line points={[lineX - tickLen, dim.end, lineX + tickLen, dim.end]} stroke="#94a3b8" strokeWidth={1.5 / zoom} />
                    <Text
                        x={xPos}
                        y={midY}
                        text={dim.label.text}
                        fontSize={fontSize}
                        fill={dim.label.color}
                        fontStyle="bold"
                        align="center"
                        offsetX={30}
                        rotation={-90}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>
            );
        });

        if (elements.length === 0) return null;
        return <Group listening={false}>{elements}</Group>;
    }, [lists, products, zoom, textScale, shouldHideText, bounds]);

    const getPointerPosition = () => {
        const stage = stageRef.current;
        if (!stage) return null;
        const transform = stage.getAbsoluteTransform().copy();
        transform.invert();
        const pos = stage.getPointerPosition();
        if (!pos) return null;
        return transform.point(pos);
    };

    const handleMouseDown = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;

        const pointerPos = stage.getPointerPosition();
        if (!pointerPos) return;

        // Block interaction start if multi-touch (pinch-zoom handling)
        if (e.evt?.touches?.length > 1) return;

        // If it's a touch event, prevent default to stop simulated mouse events
        if (e.evt && 'touches' in e.evt) {
            if (e.evt.touches.length <= 1) {
                e.evt.preventDefault();
            }
        }

        // Ctrl + Drag for panning (anywhere) or Pan Mode (only if clicking background)
        const isStage = e.target === stage;
        if (e.evt?.ctrlKey || (interactionMode === 'pan' && isStage)) {
            isPanningRef.current = true;
            lastPointerPos.current = pointerPos;
            e.evt?.preventDefault?.();
            return;
        }

        // If clicking on a shape (like a point handle), don't trigger stage actions
        // But allow clicking on design areas (panels) to draw lists or place items on them
        const isDesignArea = e.target.name() === 'design-area';
        if (!isStage && !isDesignArea) return;

        const pos = getPointerPosition();
        if (!pos) return;

        // Middle Click or Space + Drag for panning (alternative)
        if (e.evt.button === 1 || e.evt.buttons === 4) {
            isPanningRef.current = true;
            lastPointerPos.current = pointerPos;
            return;
        }

        if (!isClosed) {
            if (isWallLocked) return; // Prevent adding points when locked
            addPoint(pos.x, pos.y);
        } else if (interactionMode === 'place') {
            const selectedProduct = products.find(p => p.id === useCanvasStore.getState().selectedProductId);
            if (!selectedProduct) return;
            const snappedPos = snapToGap(pos, false);
            startDesignArea(snappedPos.x, snappedPos.y);
        } else if (interactionMode === 'window' || interactionMode === 'door') {
            const snappedPos = snapToGap(pos, false);
            startOpening(snappedPos.x, snappedPos.y, interactionMode);
        } else if (interactionMode === 'list') {
            const selectedProduct = products.find(p => p.id === useCanvasStore.getState().selectedProductId);
            if (!selectedProduct) return;
            const isMoulding = selectedProduct?.category === 'moulding' && !selectedProduct?.name?.toLowerCase().includes('lis');
            const isLisPlat = selectedProduct?.name?.toLowerCase().includes('lis plat') || selectedProduct?.countType === 'meter';
            const gapPx = isLisPlat ? 0.05 * SCALE : (isMoulding ? mouldingGap * SCALE : 0);
            const snappedPos = listDrawingType === 'rectangle'
                ? snapKotakMode(pos, gapPx)
                : snapToGap(pos, gapPx > 0, gapPx);
            startList(snappedPos.x, snappedPos.y);
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;

        const touch1 = e.evt?.touches?.[0];
        const touch2 = e.evt?.touches?.[1];

        // If it's a touch event, prevent default to stop simulated mouse events
        // except for gestures handled elsewhere if needed
        if (e.evt && 'touches' in e.evt) {
            if (e.evt.touches.length <= 1) {
                e.evt.preventDefault();
            }
        }

        // Multi-touch Zoom and Pan
        if (touch1 && touch2) {
            e.evt.preventDefault();
            const p1 = { x: touch1.clientX, y: touch1.clientY };
            const p2 = { x: touch2.clientX, y: touch2.clientY };

            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const center = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2,
            };

            if (!lastDist.current) {
                lastDist.current = dist;
                lastCenter.current = center;
                return;
            }

            const scaleBy = dist / lastDist.current;
            const newScale = zoom * scaleBy;

            if (newScale >= 0.1 && newScale <= 10) {
                const stagePos = stage.container().getBoundingClientRect();
                const centerOnStage = {
                    x: (center.x - stagePos.left - offset.x) / zoom,
                    y: (center.y - stagePos.top - offset.y) / zoom,
                };

                const newOffset = {
                    x: center.x - stagePos.left - centerOnStage.x * newScale,
                    y: center.y - stagePos.top - centerOnStage.y * newScale,
                };

                // Add panning displacement
                if (lastCenter.current) {
                    newOffset.x += center.x - lastCenter.current.x;
                    newOffset.y += center.y - lastCenter.current.y;
                }

                setZoom(newScale);
                setOffset(newOffset.x, newOffset.y);
            }

            lastDist.current = dist;
            lastCenter.current = center;
            return;
        }

        if (isPanningRef.current) {
            e.evt?.preventDefault?.();
            const pointerPos = stage.getPointerPosition();
            if (pointerPos) {
                const dx = pointerPos.x - lastPointerPos.current.x;
                const dy = pointerPos.y - lastPointerPos.current.y;
                setOffset(offset.x + dx, offset.y + dy);
                lastPointerPos.current = pointerPos;
            }
            return;
        }

        // Prevent scrolling when drawing
        if (currentDrawingList || currentDrawingArea) {
            e.evt?.preventDefault();
        }

        const pos = getPointerPosition();
        if (!pos) return;

        if (currentDrawingList) {
            let newX = pos.x;
            let newY = pos.y;

            // Snap to Horizontal/Vertical relative to start point
            if (Math.abs(newX - currentDrawingList.x1) < SNAP_THRESHOLD) {
                newX = currentDrawingList.x1;
            }
            if (Math.abs(newY - currentDrawingList.y1) < SNAP_THRESHOLD) {
                newY = currentDrawingList.y1;
            }

            const selectedProduct = products.find(p => p.id === useCanvasStore.getState().selectedProductId);
            const isMoulding = selectedProduct?.category === 'moulding' && !selectedProduct?.name?.toLowerCase().includes('lis');
            const isLisPlat = selectedProduct?.name?.toLowerCase().includes('lis plat') || selectedProduct?.countType === 'meter';
            const gapPx = isLisPlat ? 0.05 * SCALE : (isMoulding ? mouldingGap * SCALE : 0);

            // --- Dimension Snapping for Rectangles ---
            if (listDrawingType === 'rectangle') {
                const currentWidth = Math.abs(newX - currentDrawingList.x1);
                const currentHeight = Math.abs(newY - currentDrawingList.y1);

                const potentialWidths: number[] = [];
                const potentialHeights: number[] = [];

                // Collect dimensions from existing lists (moulding segments)
                lists.forEach(l => {
                    const dx = Math.abs(l.x2 - l.x1);
                    const dy = Math.abs(l.y2 - l.y1);
                    // If it's a straight segment, it's likely part of a rectangle or a line
                    if (dx > 5 && dy < 1) potentialWidths.push(dx);
                    if (dy > 5 && dx < 1) potentialHeights.push(dy);
                });

                // Collect dimensions from design areas
                designAreas.forEach(da => {
                    potentialWidths.push(Math.abs(da.width));
                    potentialHeights.push(Math.abs(da.height));
                });

                // Snap Width
                for (const targetW of potentialWidths) {
                    if (Math.abs(currentWidth - targetW) < SNAP_THRESHOLD) {
                        const direction = newX >= currentDrawingList.x1 ? 1 : -1;
                        newX = currentDrawingList.x1 + direction * targetW;
                        break;
                    }
                }

                // Snap Height
                for (const targetH of potentialHeights) {
                    if (Math.abs(currentHeight - targetH) < SNAP_THRESHOLD) {
                        const direction = newY >= currentDrawingList.y1 ? 1 : -1;
                        newY = currentDrawingList.y1 + direction * targetH;
                        break;
                    }
                }
            }
            const snappedPos = listDrawingType === 'rectangle'
                ? snapKotakMode({ x: newX, y: newY }, gapPx)
                : snapToGap({ x: newX, y: newY }, gapPx > 0, gapPx);
            newX = snappedPos.x;
            newY = snappedPos.y;

            updateList(newX, newY);
            return;
        }

        if (!currentDrawingArea) return;

        if ('productId' in currentDrawingArea) {
            const snappedPos = snapToGap(pos, false);
            updateDesignArea(snappedPos.x, snappedPos.y);
        } else {
            const snappedPos = snapToGap(pos, false);
            updateOpening(snappedPos.x, snappedPos.y);
        }
    };

    const handleMouseUp = (e: any) => {
        // If it's a touch event, prevent default to stop simulated mouse events
        if (e.evt && 'touches' in e.evt) {
            if (e.evt.touches.length <= 1) {
                e.evt.preventDefault();
            }
        }
        lastDist.current = 0;
        lastCenter.current = null;
        if (isPanningRef.current) {
            isPanningRef.current = false;
            return;
        }

        if (currentDrawingList) {
            finishList();
            return;
        }

        if (!currentDrawingArea) return;

        if ('productId' in currentDrawingArea) {
            finishDesignArea();
        } else {
            finishOpening();
        }
    };

    const handleDragMove = (e: any, index: number) => {
        if (isWallLocked) return; // Prevent dragging points when locked

        let newX = e.target.x() + 4 / zoom;
        let newY = e.target.y() + 4 / zoom;

        // Snapping Logic
        const neighbors = [];
        if (index > 0) neighbors.push(points[index - 1]);
        else if (isClosed) neighbors.push(points[points.length - 1]);

        if (index < points.length - 1) neighbors.push(points[index + 1]);
        else if (isClosed) neighbors.push(points[0]);

        // Snap to H/V alignment
        neighbors.forEach(n => {
            if (Math.abs(newX - n.x) < SNAP_THRESHOLD) newX = n.x;
            if (Math.abs(newY - n.y) < SNAP_THRESHOLD) newY = n.y;
        });

        // Force target to snapped coordinates to prevent visual detachment
        e.target.x(newX - 4 / zoom);
        e.target.y(newY - 4 / zoom);

        updatePoint(index, newX, newY);
    };

    const handleWheel = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;

        // ZOOM LOGIC
        if (e.evt.ctrlKey || e.evt.shiftKey) {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

            // Limit scale
            if (newScale < 0.1 || newScale > 10) return;

            setZoom(newScale);

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };

            setOffset(newPos.x, newPos.y);
        }
    };

    if (!mounted) return <div className="w-full h-full bg-white flex items-center justify-center">Loading Editor...</div>;

    const gridSize = isMobile ? 100 : 50;

    // Ensure we have a size, fallback to 900x600 if measurement fails initially
    const width = stageSize.width || 900;
    const height = stageSize.height || 600;

    // Infinite Grid Calculation
    const visibleX = -offset.x / zoom;
    const visibleY = -offset.y / zoom;
    const visibleWidth = width / zoom;
    const visibleHeight = height / zoom;

    const startX = Math.floor(visibleX / gridSize) * gridSize;
    const startY = Math.floor(visibleY / gridSize) * gridSize;
    const endX = visibleX + visibleWidth;
    const endY = visibleY + visibleHeight;



    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ touchAction: 'none' }}>
            <Stage
                ref={stageRef}
                width={width}
                height={height}
                pixelRatio={Math.min(window.devicePixelRatio || 1, 1.5)}
                onMouseDown={props.readOnly ? undefined : handleMouseDown}
                onMouseMove={props.readOnly ? undefined : handleMouseMove}
                onMouseUp={props.readOnly ? undefined : handleMouseUp}
                onTouchStart={props.readOnly ? undefined : handleMouseDown}
                onTouchMove={props.readOnly ? undefined : handleMouseMove}
                onTouchEnd={props.readOnly ? undefined : handleMouseUp}
                onWheel={props.readOnly ? undefined : handleWheel}
                scaleX={zoom}
                scaleY={zoom}
                x={offset.x}
                y={offset.y}
                draggable={false}
                listening={true}
                perfectDrawEnabled={!isMobile && !isTablet}
                shadowForStrokeEnabled={false}
                style={{
                    cursor: 'default',
                    touchAction: 'none',
                    pointerEvents: 'auto'
                }}
            >
                <Layer>
                    {!isClosed && (
                        <Text
                            text="Klik untuk menempatkan sudut dinding. Tekan Ctrl+Drag untuk Pindah. Scroll untuk Zoom."
                            x={visibleX + 20 / zoom}
                            y={visibleY + 20 / zoom}
                            fill="#64748b"
                            fontStyle="italic"
                            fontSize={14}
                            scaleX={textScale}
                            scaleY={textScale}
                            listening={false}
                        />
                    )}

                    {/* Wall Surface (Background) */}
                    {(() => {
                        // For ceiling walls, use the selected plafon product color as fill
                        const plafonProduct = activeWall?.type === 'ceiling'
                            ? products.find((p: Product) => p.category?.toLowerCase() === 'plafon')
                            : undefined;
                        const ceilingFill = plafonProduct?.color || '#ffffff';
                        const isTexture = !!ceilingFill && (ceilingFill.startsWith('http') || ceilingFill.startsWith('data:'));
                        return (
                            <Line
                                points={points.flatMap(p => [p.x, p.y])}
                                fill={isTexture ? undefined : ceilingFill}
                                stroke="#64748b"
                                strokeWidth={2 / zoom}
                                closed={isClosed}
                                listening={false}
                            />
                        );
                    })()}

                    {isClosed && activeWall?.type === 'ceiling' && (() => {
                        const plafonProduct = products.find((p: Product) => p.category?.toLowerCase() === 'plafon');
                        const ceilingFill = plafonProduct?.color || '#ffffff';
                        const isTexture = !!ceilingFill && (ceilingFill.startsWith('http') || ceilingFill.startsWith('data:'));
                        const productPanelWidth = plafonProduct?.width ? plafonProduct.width * SCALE : (activeWall.ceilingPanelWidth || 20) / 100 * SCALE;
                        return isTexture ? (
                            <CeilingTextureRect
                                clipFunc={clipFunc}
                                bounds={bounds}
                                textureUrl={ceilingFill}
                                panelWidth={productPanelWidth}
                                panelHeight={productPanelWidth}
                                direction={activeWall.ceilingPanelDirection || 'horizontal'}
                            />
                        ) : null;
                    })()}

                    {isClosed && activeWall?.type === 'ceiling' && (
                        <Group clipFunc={clipFunc}>
                            {(() => {
                                const elements = [];
                                const plafonProduct = products.find((p: Product) => p.category?.toLowerCase() === 'plafon');
                                const PANEL_WIDTH = plafonProduct?.width ? plafonProduct.width * SCALE : (activeWall.ceilingPanelWidth || 20) / 100 * SCALE;
                                const direction = activeWall.ceilingPanelDirection || 'horizontal';

                                if (!isColoringMode) {
                                    if (direction === 'vertical') {
                                        const startX = bounds.minX;
                                        const numPanels = Math.ceil(bounds.width / PANEL_WIDTH);
                                        for (let i = 1; i <= numPanels; i++) {
                                            const x = startX + i * PANEL_WIDTH;
                                            elements.push(
                                                <Line
                                                    key={`ceiling-panel-v-${i}`}
                                                    points={[x, bounds.minY, x, bounds.minY + bounds.height]}
                                                    stroke="#cbd5e1"
                                                    strokeWidth={1 / zoom}
                                                    listening={false}
                                                />
                                            );
                                        }
                                    } else {
                                        const startY = bounds.minY;
                                        const numPanels = Math.ceil(bounds.height / PANEL_WIDTH);
                                        for (let i = 1; i <= numPanels; i++) {
                                            const y = startY + i * PANEL_WIDTH;
                                            elements.push(
                                                <Line
                                                    key={`ceiling-panel-h-${i}`}
                                                    points={[bounds.minX, y, bounds.minX + bounds.width, y]}
                                                    stroke="#cbd5e1"
                                                    strokeWidth={1 / zoom}
                                                    listening={false}
                                                />
                                            );
                                        }
                                    }
                                }

                                // Draw Traps
                                const traps = activeWall.ceilingTraps || [];
                                let currentInset = 0;
                                traps.forEach((trap: any, i: number) => {
                                    currentInset += (trap.width / 100) * SCALE;
                                    const tw = bounds.width - 2 * currentInset;
                                    const th = bounds.height - 2 * currentInset;

                                    if (tw > 0 && th > 0) {
                                        elements.push(
                                            <Rect
                                                key={`trap-${i}-drop`}
                                                x={bounds.minX + currentInset}
                                                y={bounds.minY + currentInset}
                                                width={tw}
                                                height={th}
                                                stroke="#3b82f6" // blue-500
                                                strokeWidth={3 / zoom}
                                                dash={[10 / zoom, 10 / zoom]}
                                                listening={false}
                                            />
                                        );
                                    }
                                    currentInset += (trap.gap / 100) * SCALE;
                                });

                                return elements;
                            })()}
                        </Group>
                    )}

                    {isClosed && renderedAreas}
                    {isClosed && renderedMouldingDimensions}

                    {/* Measurements & Dimensions */}
                    {points.map((point, i) => {
                        if (i === points.length - 1 && !isClosed) return null;

                        const nextPoint = points[(i + 1) % points.length];
                        const dx = nextPoint.x - point.x;
                        const dy = nextPoint.y - point.y;
                        const lengthPx = Math.hypot(dx, dy);
                        if (lengthPx < 5) return null;

                        const lengthM = (lengthPx / SCALE).toFixed(2);
                        const isEditing = editingIndex === i;

                        // Calculate normal
                        const midX = (point.x + nextPoint.x) / 2;
                        const midY = (point.y + nextPoint.y) / 2;

                        const centerX = bounds.minX + bounds.width / 2;
                        const centerY = bounds.minY + bounds.height / 2;

                        let nx = -dy / lengthPx;
                        let ny = dx / lengthPx;

                        // Flip normal if needed
                        const distWithNormal = Math.hypot(midX + nx * 10 - centerX, midY + ny * 10 - centerY);
                        const distWithoutNormal = Math.hypot(midX - centerX, midY - centerY);
                        if (distWithNormal < distWithoutNormal) {
                            nx = -nx;
                            ny = -ny;
                        }

                        const offsetVal = 40 / zoom;
                        const dimX1 = point.x + nx * offsetVal;
                        const dimY1 = point.y + ny * offsetVal;
                        const dimX2 = nextPoint.x + nx * offsetVal;
                        const dimY2 = nextPoint.y + ny * offsetVal;

                        // Architectural Tick angle
                        const tickLen = 6 / zoom;
                        const angle = Math.atan2(dy, dx);

                        if (shouldHideText) return null;

                        return (
                            <Group key={`dim-${i}`} onClick={() => { if (!isWallLocked) handleLabelClick(i, lengthM); }} onTap={() => { if (!isWallLocked) handleLabelClick(i, lengthM); }}>
                                {/* Extension Lines */}
                                <Line
                                    points={[point.x + nx * (5 / zoom), point.y + ny * (5 / zoom), point.x + nx * (offsetVal + 10 / zoom), point.y + ny * (offsetVal + 10 / zoom)]}
                                    stroke="#94a3b8"
                                    strokeWidth={1 / zoom}
                                />
                                <Line
                                    points={[nextPoint.x + nx * (5 / zoom), nextPoint.y + ny * (5 / zoom), nextPoint.x + nx * (offsetVal + 10 / zoom), nextPoint.y + ny * (offsetVal + 10 / zoom)]}
                                    stroke="#94a3b8"
                                    strokeWidth={1 / zoom}
                                />

                                {/* Dimension Line */}
                                <Line
                                    points={[dimX1, dimY1, dimX2, dimY2]}
                                    stroke="#475569"
                                    strokeWidth={1 / zoom}
                                />

                                {/* Architectural Ticks */}
                                <Line
                                    points={[
                                        dimX1 - Math.cos(angle + Math.PI / 2) * tickLen, dimY1 - Math.sin(angle + Math.PI / 2) * tickLen,
                                        dimX1 + Math.cos(angle + Math.PI / 2) * tickLen, dimY1 + Math.sin(angle + Math.PI / 2) * tickLen
                                    ]}
                                    stroke="#475569"
                                    strokeWidth={1.5 / zoom}
                                />
                                <Line
                                    points={[
                                        dimX2 - Math.cos(angle + Math.PI / 2) * tickLen, dimY2 - Math.sin(angle + Math.PI / 2) * tickLen,
                                        dimX2 + Math.cos(angle + Math.PI / 2) * tickLen, dimY2 + Math.sin(angle + Math.PI / 2) * tickLen
                                    ]}
                                    stroke="#475569"
                                    strokeWidth={1.5 / zoom}
                                />

                                {!isEditing && (
                                    <Text
                                        x={(dimX1 + dimX2) / 2}
                                        y={(dimY1 + dimY2) / 2}
                                        text={`${lengthM}m`}
                                        fontSize={11}
                                        fill="#1e293b"
                                        fontStyle="bold"
                                        offsetX={15}
                                        offsetY={15}
                                        rotation={(angle * 180) / Math.PI}
                                        scaleX={textScale}
                                        scaleY={textScale}
                                    />
                                )}
                            </Group>
                        );
                    })}

                    {/* Points and Labels */}
                    {points.map((p, i) => {
                        const nextPoint = points[(i + 1) % points.length];
                        const dx = nextPoint.x - p.x;
                        const dy = nextPoint.y - p.y;
                        const angle = Math.atan2(dy, dx);
                        const lengthM = (Math.hypot(dx, dy) / SCALE).toFixed(2);
                        const isEditing = editingIndex === i;

                        const dimX1 = p.x + Math.sin(angle) * (30 / zoom);
                        const dimY1 = p.y - Math.cos(angle) * (30 / zoom);
                        const dimX2 = nextPoint.x + Math.sin(angle) * (30 / zoom);
                        const dimY2 = nextPoint.y - Math.cos(angle) * (30 / zoom);

                        return (
                            <Group key={i}>
                                {/* Point Handle (Hide when locked) */}
                                {!isWallLocked && !shouldHideText && (
                                    isMobile ? (
                                        // Mobile: large, finger-friendly drag handle
                                        <Group x={p.x} y={p.y}>
                                            {/* Outer dashed ring – "draggable" indicator */}
                                            <Circle
                                                radius={21 / zoom}
                                                fill="rgba(59, 130, 246, 0.12)"
                                                stroke="#3b82f6"
                                                strokeWidth={1.5 / zoom}
                                                dash={[4 / zoom, 3 / zoom]}
                                                listening={false}
                                            />
                                            {/* Main drag handle */}
                                            <Circle
                                                radius={13 / zoom}
                                                fill="#3b82f6"
                                                stroke="white"
                                                strokeWidth={2 / zoom}
                                                draggable
                                                onDragMove={(e) => {
                                                    if (isWallLocked) return;
                                                    // Get absolute screen position → convert to canvas world coords
                                                    const absPos = e.target.getAbsolutePosition();
                                                    const stage = stageRef.current;
                                                    const transform = stage.getAbsoluteTransform().copy();
                                                    transform.invert();
                                                    const world = transform.point(absPos);
                                                    // Reset shape to group origin so it doesn't visually drift
                                                    e.target.x(0);
                                                    e.target.y(0);
                                                    // Apply snapping (same as desktop)
                                                    let newX = world.x;
                                                    let newY = world.y;
                                                    const neighbors: { x: number; y: number }[] = [];
                                                    if (i > 0) neighbors.push(points[i - 1]);
                                                    else if (isClosed) neighbors.push(points[points.length - 1]);
                                                    if (i < points.length - 1) neighbors.push(points[i + 1]);
                                                    else if (isClosed) neighbors.push(points[0]);
                                                    neighbors.forEach(n => {
                                                        if (Math.abs(newX - n.x) < SNAP_THRESHOLD) newX = n.x;
                                                        if (Math.abs(newY - n.y) < SNAP_THRESHOLD) newY = n.y;
                                                    });
                                                    updatePoint(i, newX, newY);
                                                }}
                                            />
                                            {/* Crosshair icon – universal "move" symbol */}
                                            <Line
                                                points={[-6 / zoom, 0, 6 / zoom, 0]}
                                                stroke="white"
                                                strokeWidth={2 / zoom}
                                                listening={false}
                                            />
                                            <Line
                                                points={[0, -6 / zoom, 0, 6 / zoom]}
                                                stroke="white"
                                                strokeWidth={2 / zoom}
                                                listening={false}
                                            />
                                        </Group>
                                    ) : (
                                        // Desktop: original small square handle
                                        <Rect
                                            x={p.x - 4 / zoom}
                                            y={p.y - 4 / zoom}
                                            width={8 / zoom}
                                            height={8 / zoom}
                                            fill="white"
                                            stroke="#0f172a"
                                            strokeWidth={1 / zoom}
                                            hitStrokeWidth={20 / zoom}
                                            draggable
                                            onDragMove={(e) => handleDragMove(e, i)}
                                            onMouseEnter={(e: any) => {
                                                const container = e.target.getStage().container();
                                                container.style.cursor = 'move';
                                            }}
                                            onMouseLeave={(e: any) => {
                                                const container = e.target.getStage().container();
                                                container.style.cursor = isClosed ? 'default' : 'crosshair';
                                            }}
                                        />
                                    )
                                )}
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>

            {editingIndex !== null && points.length > editingIndex && (
                (() => {
                    // Calculating input position in screen coordinates
                    const p1 = points[editingIndex];
                    const p2 = points[(editingIndex + 1) % points.length];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    // Convert to screen coords
                    const screenX = midX * zoom + offset.x;
                    const screenY = midY * zoom + offset.y;

                    if (isMobile) {
                        // Mobile: centered modal-style input overlay
                        return (
                            <>
                                {/* Backdrop – tap outside to dismiss */}
                                <div
                                    onClick={() => setEditingIndex(null)}
                                    style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0,0,0,0.25)',
                                        zIndex: 20
                                    }}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        background: 'white',
                                        borderRadius: 16,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                        padding: '20px 24px',
                                        zIndex: 21,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 12,
                                        minWidth: 220
                                    }}
                                >
                                    <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 600 }}>Ubah Panjang Sisi</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            ref={inputRef}
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            style={{
                                                width: 110,
                                                fontSize: 22,
                                                fontWeight: 700,
                                                textAlign: 'center',
                                                border: '2px solid #3b82f6',
                                                borderRadius: 10,
                                                padding: '8px 10px',
                                                outline: 'none',
                                                color: '#1e293b'
                                            }}
                                        />
                                        <span style={{ fontSize: 18, color: '#64748b', fontWeight: 600 }}>m</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                                        <button
                                            onClick={() => setEditingIndex(null)}
                                            style={{
                                                flex: 1,
                                                padding: '10px 0',
                                                borderRadius: 10,
                                                border: '1.5px solid #cbd5e1',
                                                background: 'white',
                                                color: '#64748b',
                                                fontSize: 15,
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >Batal</button>
                                        <button
                                            onClick={handleInputCommit}
                                            style={{
                                                flex: 1,
                                                padding: '10px 0',
                                                borderRadius: 10,
                                                border: 'none',
                                                background: '#3b82f6',
                                                color: 'white',
                                                fontSize: 15,
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >✓ OK</button>
                                    </div>
                                </div>
                            </>
                        );
                    }

                    // Desktop: inline floating input
                    return (
                        <input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onBlur={handleInputCommit}
                            onKeyDown={handleKeyDown}
                            style={{
                                position: 'absolute',
                                left: screenX - 30,
                                top: screenY - 10,
                                width: 60,
                                zIndex: 10
                            }}
                        />
                    );
                })()
            )}
        </div>
    );
});

export default WallEditor;
