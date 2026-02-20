'use client';
import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import { useCanvasStore, SCALE, PRODUCTS, DesignArea } from '../store/useCanvasStore';
import { getPolygonRectIntersectionArea } from '../function/geometry';

const WallEditor = forwardRef((props, ref) => {
    const stageRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        getStage: () => stageRef.current
    }));
    const {
        points, isClosed, addPoint, updatePoint, updateEdgeLength,
        interactionMode, designAreas, currentDrawingArea, openings, lists, currentDrawingList,
        startDesignArea, updateDesignArea, finishDesignArea, removeDesignArea,
        startOpening, updateOpening, finishOpening, removeOpening,
        startList, updateList, finishList, removeList,
        zoom, offset, setZoom, setOffset,
        undo, redo
    } = useCanvasStore();

    // Interaction State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Dynamic Text Scale: Text grows slightly as you zoom in
    const textScale = 1 / Math.pow(zoom, 0.7);

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
        // Prevent editing while dragging points or not closed
        if (!isClosed) return;
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
    const renderAreaContent = (area: DesignArea | any) => {
        // Guard: ensure it's a product area
        if (!('productId' in area)) return null;

        const product = PRODUCTS.find(p => p.id === area.productId);
        if (!product) return null;

        const panelWidthPx = product.width * SCALE;
        const panelHeightPx = product.height * SCALE;

        // Grid lines calculation (visual only)
        const horizontalCount = Math.ceil(Math.abs(area.width) / panelWidthPx);
        const verticalCount = Math.ceil(Math.abs(area.height) / panelHeightPx);

        // Area-based count for the label
        const intersectAreaPx2 = getPolygonRectIntersectionArea(points, area);
        const areaM2 = intersectAreaPx2 / (SCALE * SCALE);
        const productAreaM2 = product.width * product.height;
        const baseCount = Math.ceil(areaM2 / productAreaM2);
        const count = baseCount > 0 ? baseCount + 1 : 0;

        const lines = [];

        // Vertical lines (columns)
        for (let i = 1; i < horizontalCount; i++) {
            lines.push(
                <Line
                    key={`vline-${i}`}
                    points={[i * panelWidthPx, 0, i * panelWidthPx, area.height]}
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1 / zoom}
                    dash={[5 / zoom, 5 / zoom]}
                />
            );
        }

        // Horizontal lines (rows)
        for (let i = 1; i < verticalCount; i++) {
            lines.push(
                <Line
                    key={`hline-${i}`}
                    points={[0, i * panelHeightPx, area.width, i * panelHeightPx]}
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1 / zoom}
                    dash={[5 / zoom, 5 / zoom]}
                />
            );
        }

        const isLengthBased = product.countType === 'length';
        const color = product.color.replace('0.4', '1');
        const absWidth = Math.abs(area.width);
        const absHeight = Math.abs(area.height);

        // Dimensions for professional look
        const dimOffset = 20 / zoom;
        const tickLen = 4 / zoom;

        return (
            <Group x={area.x} y={area.y}>
                <Rect
                    name="design-area"
                    width={area.width}
                    height={area.height}
                    fill={isLengthBased ? "transparent" : product.color}
                    stroke={isLengthBased ? color : "#1e293b"}
                    strokeWidth={isLengthBased ? 2 / zoom : 1 / zoom}
                    onClick={() => {
                        if (interactionMode === 'delete') removeDesignArea(area.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeDesignArea(area.id);
                    }}
                />

                {/* Product Name */}
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

                {/* Width Dimension Line (Bottom) */}
                <Group y={area.height + dimOffset}>
                    <Line points={[0, 0, area.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    {/* Ticks */}
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

                {/* Height Dimension Line (Right) */}
                <Group x={area.width + dimOffset}>
                    <Line points={[0, 0, 0, area.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    {/* Ticks */}
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

                {!isLengthBased && (
                    <Group clipFunc={(ctx) => {
                        ctx.rect(0, 0, area.width, area.height);
                    }}>
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
    };

    const renderOpeningContent = (opening: any) => {
        // Guard: ensure it's an opening
        if (!('type' in opening)) return null;

        const isWindow = opening.type === 'window';
        const color = isWindow ? "rgba(14, 165, 233, 0.6)" : "rgba(217, 119, 6, 0.6)";
        const label = isWindow ? "Window" : "Door";

        const absWidth = Math.abs(opening.width);
        const absHeight = Math.abs(opening.height);

        // Dimensions for professional look
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
                    onClick={() => {
                        if (interactionMode === 'delete') removeOpening(opening.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeOpening(opening.id);
                    }}
                />
                {/* Cross lines to indicate opening */}
                <Line
                    points={[0, 0, opening.width, opening.height]}
                    stroke="white"
                    strokeWidth={2 / zoom}
                />
                <Line
                    points={[0, opening.height, opening.width, 0]}
                    stroke="white"
                    strokeWidth={2 / zoom}
                />
                <Text
                    text={label}
                    fontSize={12}
                    fill="white"
                    fontStyle="bold"
                    align="center"
                    width={opening.width}
                    y={opening.height / 2 - 12 / zoom}
                    scaleX={textScale}
                    scaleY={textScale}
                />

                {/* Width Dimension Line (Bottom) */}
                <Group y={opening.height + dimOffset}>
                    <Line points={[0, 0, opening.width, 0]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, tickLen, tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[opening.width - tickLen, tickLen, opening.width + tickLen, -tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text
                        text={`${(absWidth / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={opening.width / 2}
                        y={-12 / zoom}
                        offsetX={15}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>

                {/* Height Dimension Line (Right) */}
                <Group x={opening.width + dimOffset}>
                    <Line points={[0, 0, 0, opening.height]} stroke="#64748b" strokeWidth={0.8 / zoom} />
                    <Line points={[-tickLen, -tickLen, tickLen, tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Line points={[-tickLen, opening.height - tickLen, tickLen, opening.height + tickLen]} stroke="#64748b" strokeWidth={1 / zoom} />
                    <Text
                        text={`${(absHeight / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={4 / zoom}
                        y={opening.height / 2}
                        rotation={90}
                        offsetX={15}
                        scaleX={textScale}
                        scaleY={textScale}
                    />
                </Group>
            </Group>
        );
    };

    const renderListContent = (list: any) => {
        const product = PRODUCTS.find(p => p.id === list.productId);
        const color = product?.color.replace('0.4', '1') || "#8b5cf6";
        const unitLength = product?.unitLength || 2.9;
        const dx = list.x2 - list.x1;
        const dy = list.y2 - list.y1;
        const lengthPx = Math.hypot(dx, dy);
        const lengthM = (lengthPx / SCALE).toFixed(2);
        const midX = (list.x1 + list.x2) / 2;
        const midY = (list.y1 + list.y2) / 2;
        const baseCount = Math.ceil((lengthPx / SCALE) / unitLength);
        const count = baseCount > 0 ? baseCount + 1 : 0;
        const angle = Math.atan2(dy, dx);
        const tickLen = 6 / zoom;

        return (
            <Group>
                {/* Main segment */}
                <Line
                    points={[list.x1, list.y1, list.x2, list.y2]}
                    stroke={color}
                    strokeWidth={2 / zoom}
                    onClick={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                />

                {/* Architectural Ticks */}

                {/* Label */}
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
                {currentDrawingList && renderListContent(currentDrawingList)}
            </Group>
        );
    }, [designAreas, openings, lists, currentDrawingArea, currentDrawingList, clipFunc, interactionMode, zoom]);

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

        // Ctrl + Drag for panning
        if (e.evt.ctrlKey) {
            setIsPanning(true);
            lastPointerPos.current = pointerPos;
            return;
        }

        const pos = getPointerPosition();
        if (!pos) return;

        // Middle Click or Space + Drag for panning (alternative)
        if (e.evt.button === 1 || e.evt.buttons === 4) {
            setIsPanning(true);
            lastPointerPos.current = pointerPos;
            return;
        }

        if (!isClosed) {
            addPoint(pos.x, pos.y);
        } else if (interactionMode === 'place') {
            startDesignArea(pos.x, pos.y);
        } else if (interactionMode === 'window' || interactionMode === 'door') {
            startOpening(pos.x, pos.y, interactionMode);
        } else if (interactionMode === 'list') {
            startList(pos.x, pos.y);
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = stageRef.current;
        if (!stage) return;

        if (isPanning) {
            const pointerPos = stage.getPointerPosition();
            if (pointerPos) {
                const dx = pointerPos.x - lastPointerPos.current.x;
                const dy = pointerPos.y - lastPointerPos.current.y;
                setOffset(offset.x + dx, offset.y + dy);
                lastPointerPos.current = pointerPos;
            }
            return;
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

            updateList(newX, newY);
            return;
        }

        if (!currentDrawingArea) return;

        if ('productId' in currentDrawingArea) {
            updateDesignArea(pos.x, pos.y);
        } else {
            updateOpening(pos.x, pos.y);
        }
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
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
        // Simple wheel scroll (no Ctrl/Shift) is allowed to propagate to browser,
        // and doesn't pan the canvas anymore.
    };

    if (!mounted) return <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">Loading Editor...</div>;

    const gridSize = 50;

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
    for (let x = startX; x < endX + gridSize; x += gridSize) {
        gridLines.push(<Line key={`v-${x}`} points={[x, startY, x, endY + gridSize]} stroke="#e2e8f0" strokeWidth={1 / zoom} />);
    }

    for (let y = startY; y < endY + gridSize; y += gridSize) {
        gridLines.push(<Line key={`h-${y}`} points={[startX, y, endX + gridSize, y]} stroke="#e2e8f0" strokeWidth={1 / zoom} />);
    }

    return (
        <div ref={containerRef} className="relative flex-1 w-full h-full border-2 border-slate-300 rounded-lg overflow-hidden bg-[#fdfbf7] shadow-xl" style={{ minHeight: '600px' }}>
            <Stage
                ref={stageRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                scaleX={zoom}
                scaleY={zoom}
                x={offset.x}
                y={offset.y}
                draggable={false}
                style={{
                    cursor: isPanning ? 'grabbing' : (isClosed ? 'default' : 'crosshair')
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

                    {isClosed && renderedAreas}

                    <Line
                        points={flattenedPoints}
                        stroke="#0f172a"
                        strokeWidth={1.5 / zoom}
                        closed={isClosed}
                        fill={isClosed ? "rgba(15, 23, 42, 0.03)" : undefined}
                    />

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
                            <Group key={`dim-${i}`} onClick={() => handleLabelClick(i, lengthM)}>
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

                    {points.map((point, i) => (
                        <Rect
                            key={i}
                            x={point.x - 4 / zoom}
                            y={point.y - 4 / zoom}
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
                    ))}
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
