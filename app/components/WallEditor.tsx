'use client';
import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
export const dynamic = 'force-static';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import { useCanvasStore, SCALE, DesignArea, Product } from '../store/useCanvasStore';
import { getPolygonRectIntersectionArea } from '../function/geometry';

// Create a singleton worker instance to be shared
let workerInstance: Worker | null = null;
if (typeof window !== 'undefined') {
    workerInstance = new Worker(new URL('../utils/calcWorker.ts', import.meta.url));
}

const useWorker = () => {
    const postMessage = useCallback((message: any) => {
        return new Promise((resolve) => {
            if (!workerInstance) return resolve(null);
            
            const requestId = Math.random().toString(36).substring(7);
            
            const handler = (e: MessageEvent) => {
                if (e.data.requestId === requestId) {
                    workerInstance?.removeEventListener('message', handler);
                    resolve(e.data);
                }
            };
            
            workerInstance.addEventListener('message', handler);
            workerInstance.postMessage({ ...message, requestId });
        });
    }, []);

    return postMessage;
};

const WallEditor = forwardRef((props, ref) => {
    const stageRef = useRef<any>(null);
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const isPanningRef = useRef(false); // Using ref for panning to avoid re-renders during mouse move

    useImperativeHandle(ref, () => ({
        getStage: () => stageRef.current
    }));

    const lastDist = useRef<number>(0);
    const lastCenter = useRef<{ x: number, y: number } | null>(null);

    const {
        walls, activeWallId, addPoint, updatePoint, updateEdgeLength,
        interactionMode, currentDrawingArea, currentDrawingList,
        startDesignArea, updateDesignArea, finishDesignArea, removeDesignArea,
        startOpening, updateOpening, finishOpening, removeOpening,
        startList, updateList, finishList, removeList,
        zoom, offset, setZoom, setOffset,
        undo, redo, mouldingGap, listDrawingType, setListDrawingType,
        products
    } = useCanvasStore();

    const activeWall = walls.find(w => w.id === activeWallId) || walls[0];
    const {
        points, isClosed, designAreas, openings, lists, isWallLocked
    } = activeWall;

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
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        setMounted(true);
        const handleResize = () => {
            if (containerRef.current) {
                setStageSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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

    const snapToGap = (pos: { x: number; y: number }, useGap: boolean = true) => {
        let snappedX = pos.x;
        let snappedY = pos.y;
        const gapPx = useGap ? mouldingGap * SCALE : 0;

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
    const MemoizedAreaContent = React.memo(({ area, product, zoom, textScale, onClick, points }: any) => {
        const [asyncAreaM2, setAsyncAreaM2] = useState<number | null>(null);
        const calculateArea = useWorker();

        useEffect(() => {
            const runCalc = async () => {
                const result: any = await calculateArea({
                    type: 'CALCULATE_AREA_INTERSECTION',
                    data: { polygon: points, rect: area }
                });
                if (result?.type === 'AREA_INTERSECTION_RESULT') {
                    setAsyncAreaM2(result.area / (SCALE * SCALE));
                }
            };
            runCalc();
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
        const dimOffset = 20 / zoom;
        const tickLen = 4 / zoom;

        return (
            <Group x={area.x} y={area.y}>
                <Rect
                    name="design-area"
                    width={area.width}
                    height={area.height}
                    fill={product.countType === 'length' ? "transparent" : product.color}
                    stroke={product.countType === 'length' ? color : "#1e293b"}
                    strokeWidth={product.countType === 'length' ? 2 / zoom : 1 / zoom}
                    onClick={onClick}
                    onTap={onClick}
                />
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
                <Group y={area.height + dimOffset}>
                    <Line points={[0, 0, area.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, tickLen, tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[area.width - tickLen, tickLen, area.width + tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text
                        text={`${(absWidth / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={area.width / 2}
                        y={-12 / zoom}
                        offsetX={15}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>
                <Group x={area.width + dimOffset}>
                    <Line points={[0, 0, 0, area.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, -tickLen, tickLen, tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[-tickLen, area.height - tickLen, tickLen, area.height + tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text
                        text={`${(absHeight / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={4 / zoom}
                        y={area.height / 2}
                        rotation={90}
                        offsetX={15}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>
                {product.countType !== 'length' && (
                    <Group clipFunc={(ctx) => ctx.rect(0, 0, area.width, area.height)}>
                        {lines}
                        <Text
                            text={`${count} pcs`}
                            fontSize={11}
                            fill="#1e293b"
                            fontStyle="bold"
                            x={area.width / 2}
                            y={area.height / 2}
                            offsetX={20}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    </Group>
                )}
            </Group>
        );
    });

    const MemoizedOpeningContent = React.memo(({ opening, zoom, textScale, onClick }: any) => {
        const isWindow = opening.type === 'window';
        const color = isWindow ? "rgba(14, 165, 233, 0.6)" : "rgba(217, 119, 6, 0.6)";
        const label = isWindow ? "Window" : "Door";
        const absWidth = Math.abs(opening.width);
        const absHeight = Math.abs(opening.height);
        const dimOffset = 20 / zoom;
        const tickLen = 4 / zoom;

        return (
            <Group x={opening.x} y={opening.y}>
                <Rect
                    width={opening.width}
                    height={opening.height}
                    fill={color}
                    stroke="white"
                    strokeWidth={2 / zoom}
                    onClick={onClick}
                    onTap={onClick}
                />
                <Line points={[0, 0, opening.width, opening.height]} stroke="white" strokeWidth={2 / zoom} />
                <Line points={[0, opening.height, opening.width, 0]} stroke="white" strokeWidth={2 / zoom} />
                <Text text={label} fontSize={12} fill="white" fontStyle="bold" align="center" width={opening.width} y={opening.height / 2 - 12 / zoom} scaleX={textScale} scaleY={textScale} />
                <Group y={opening.height + dimOffset}>
                    <Line points={[0, 0, opening.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, tickLen, tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[opening.width - tickLen, tickLen, opening.width + tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absWidth / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={opening.width / 2} y={-12 / zoom} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
                <Group x={opening.width + dimOffset}>
                    <Line points={[0, 0, 0, opening.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, -tickLen, tickLen, tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[-tickLen, opening.height - tickLen, tickLen, opening.height + tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text text={`${(absHeight / SCALE).toFixed(2)}m`} fontSize={9} fill="#475569" x={4 / zoom} y={opening.height / 2} rotation={90} offsetX={15} scaleX={textScale} scaleY={textScale} />
                </Group>
            </Group>
        );
    });

    const MemoizedListContent = React.memo(({ list, product, zoom, textScale, onClick }: any) => {
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

        return (
            <Group>
                <Line
                    points={[list.x1, list.y1, list.x2, list.y2]}
                    stroke={color}
                    strokeWidth={2 / zoom}
                    onClick={onClick}
                    onTap={onClick}
                />
                <Text
                    x={midX}
                    y={midY}
                    text={`${lengthM}m (${count}btg)`}
                    fontSize={10}
                    fill={color}
                    fontStyle="bold"
                    offsetX={30}
                    offsetY={12}
                    rotation={(angle * 180) / Math.PI}
                    scaleX={textScale}
                    scaleY={textScale}
                />
            </Group>
        );
    });

    const renderAreaContent = (area: DesignArea | any) => {
        if (!('productId' in area)) return null;
        const product = products.find(p => p.id === area.productId);
        if (!product) return null;
        return <MemoizedAreaContent area={area} product={product} zoom={zoom} textScale={textScale} points={points} onClick={() => interactionMode === 'delete' && removeDesignArea(area.id)} />;
    };

    const renderOpeningContent = (opening: any) => {
        if (!('type' in opening)) return null;
        return <MemoizedOpeningContent opening={opening} zoom={zoom} textScale={textScale} onClick={() => interactionMode === 'delete' && removeOpening(opening.id)} />;
    };

    const renderListContent = (list: any) => {
        const product = products.find(p => p.id === list.productId);
        return <MemoizedListContent list={list} product={product} zoom={zoom} textScale={textScale} onClick={() => interactionMode === 'delete' && removeList(list.id)} />;
    };

    const renderedAreas = useMemo(() => {
        return (
            <Group clipFunc={clipFunc}>
                {designAreas.map(area => (
                    <React.Fragment key={area.id}>
                        {renderAreaContent(area)}
                    </React.Fragment>
                ))}
                {openings.map(op => (
                    <React.Fragment key={op.id}>
                        {renderOpeningContent(op)}
                    </React.Fragment>
                ))}
                {lists.map(list => (
                    <React.Fragment key={list.id}>
                        {renderListContent(list)}
                    </React.Fragment>
                ))}

                {currentDrawingArea && (
                    'productId' in currentDrawingArea
                        ? renderAreaContent(currentDrawingArea)
                        : renderOpeningContent(currentDrawingArea)
                )}
                {currentDrawingList && (
                    listDrawingType === 'line' ? renderListContent(currentDrawingList) : (
                        <Rect
                            x={Math.min(currentDrawingList.x1, currentDrawingList.x2)}
                            y={Math.min(currentDrawingList.y1, currentDrawingList.y2)}
                            width={Math.abs(currentDrawingList.x2 - currentDrawingList.x1)}
                            height={Math.abs(currentDrawingList.y2 - currentDrawingList.y1)}
                            stroke="rgba(244, 63, 94, 0.8)"
                            strokeWidth={2 / zoom}
                            dash={[5 / zoom, 5 / zoom]}
                        />
                    )
                )}
            </Group>
        );
    }, [designAreas, openings, lists, currentDrawingArea, currentDrawingList, clipFunc, interactionMode, zoom, points]);

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

        // Ctrl + Drag for panning or Pan Mode
        if (e.evt?.ctrlKey || interactionMode === 'pan') {
            isPanningRef.current = true;
            lastPointerPos.current = pointerPos;
            e.evt?.preventDefault?.();
            return;
        }

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
            const snappedPos = snapToGap(pos, isMoulding);
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
            const snappedPos = snapToGap({ x: newX, y: newY }, isMoulding);
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

        let newX = e.target.x();
        let newY = e.target.y();

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

    const gridLines = [];
    if (!isMobile || zoom > 0.5) { // Hide grid on mobile when zoomed out too far
        for (let x = startX; x < endX + gridSize; x += gridSize) {
            gridLines.push(<Line key={`v-${x}`} points={[x, startY, x, endY + gridSize]} stroke="#e2e8f0" strokeWidth={1 / zoom} />);
        }

        for (let y = startY; y < endY + gridSize; y += gridSize) {
            gridLines.push(<Line key={`h-${y}`} points={[startX, y, endX + gridSize, y]} stroke="#e2e8f0" strokeWidth={1 / zoom} />);
        }
    }

    return (
        <div ref={containerRef} className="relative w-full h-full border-2 border-slate-300 rounded-lg overflow-hidden bg-white shadow-xl" style={{ touchAction: 'none' }}>
            <Stage
                ref={stageRef}
                width={width}
                height={height}
                pixelRatio={Math.min(window.devicePixelRatio || 1, 1.5)}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchMove={handleMouseMove}
                onTouchEnd={handleMouseUp}
                onWheel={handleWheel}
                scaleX={zoom}
                scaleY={zoom}
                x={offset.x}
                y={offset.y}
                draggable={false}
                style={{
                    cursor: isPanningRef.current ? 'grabbing' : (isClosed ? 'default' : 'crosshair'),
                    touchAction: 'none'
                }}
            >
                <Layer>
                    {gridLines}
                    {!isClosed && (
                        <Text
                            text="Click to place corners. Click start point to close. Ctrl+Drag to Pan. Scroll to Zoom."
                            x={visibleX + 20 / zoom}
                            y={visibleY + 20 / zoom}
                            fill="#64748b"
                            fontStyle="italic"
                            fontSize={14}
                            scaleX={textScale}
                            scaleY={textScale}
                        />
                    )}

                    {/* Wall Surface (Background) */}
                    <Line
                        points={points.flatMap(p => [p.x, p.y])}
                        fill="#f1f5f9"
                        stroke="#64748b"
                        strokeWidth={2 / zoom}
                        closed={isClosed}
                        listening={false}
                    />

                    {isClosed && renderedAreas}

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
                                        dimX1 - Math.cos(angle + Math.PI / 4) * tickLen, dimY1 - Math.sin(angle + Math.PI / 4) * tickLen,
                                        dimX1 + Math.cos(angle + Math.PI / 4) * tickLen, dimY1 + Math.sin(angle + Math.PI / 4) * tickLen
                                    ]}
                                    stroke="#475569"
                                    strokeWidth={1.5 / zoom}
                                />
                                <Line
                                    points={[
                                        dimX2 - Math.cos(angle + Math.PI / 4) * tickLen, dimY2 - Math.sin(angle + Math.PI / 4) * tickLen,
                                        dimX2 + Math.cos(angle + Math.PI / 4) * tickLen, dimY2 + Math.sin(angle + Math.PI / 4) * tickLen
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
                                {!isWallLocked && (
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
                                                    const neighbors: {x: number; y: number}[] = [];
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
