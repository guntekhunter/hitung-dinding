'use client';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Text, Group, Rect } from 'react-konva';
import { useCanvasStore, SCALE, PANEL_WIDTH_METERS, PRODUCTS, DesignArea } from '../store/useCanvasStore';

const WallEditor = () => {
    const {
        points, isClosed, addPoint, updatePoint, updateEdgeLength,
        direction, selectedProductId,
    } = useCanvasStore();

    // Interaction State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);
    const dragOriginRef = useRef<{ x: number, y: number } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (editingIndex !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingIndex]);

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

    const SNAP_THRESHOLD = 20; // Pixels to snap

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
    const {
        interactionMode, designAreas, currentDrawingArea, openings, lists, currentDrawingList,
        startDesignArea, updateDesignArea, finishDesignArea, removeDesignArea,
        startOpening, updateOpening, finishOpening, removeOpening,
        startList, updateList, finishList, removeList
    } = useCanvasStore();

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
        const areaM2 = (Math.abs(area.width) / SCALE) * (Math.abs(area.height) / SCALE);
        const productAreaM2 = product.width * product.height;
        const count = Math.ceil(areaM2 / productAreaM2);

        const lines = [];

        // Vertical lines (columns)
        for (let i = 1; i < horizontalCount; i++) {
            lines.push(
                <Line
                    key={`vline-${i}`}
                    points={[i * panelWidthPx, 0, i * panelWidthPx, area.height]}
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth={1}
                    dash={[5, 5]}
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
                    strokeWidth={1}
                    dash={[5, 5]}
                />
            );
        }

        const isLengthBased = product.countType === 'length';
        const color = product.color.replace('0.4', '1');
        const absWidth = Math.abs(area.width);
        const absHeight = Math.abs(area.height);

        // Dimensions for professional look
        const dimOffset = 20; // Closer than wall dimensions (40px)
        const tickLen = 4;

        return (
            <Group x={area.x} y={area.y}>
                <Rect
                    name="design-area"
                    width={area.width}
                    height={area.height}
                    fill={isLengthBased ? "transparent" : product.color}
                    stroke={isLengthBased ? color : "#1e293b"}
                    strokeWidth={isLengthBased ? 2 : 1}
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
                    x={5}
                    y={5}
                    width={area.width - 10}
                />

                {/* Width Dimension Line (Bottom) */}
                <Group y={area.height + dimOffset}>
                    <Line points={[0, 0, area.width, 0]} stroke="#64748b" strokeWidth={0.8} />
                    {/* Ticks */}
                    <Line points={[-tickLen, tickLen, tickLen, -tickLen]} stroke="#64748b" strokeWidth={1} />
                    <Line points={[area.width - tickLen, tickLen, area.width + tickLen, -tickLen]} stroke="#64748b" strokeWidth={1} />
                    <Text
                        text={`${(absWidth / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={area.width / 2}
                        y={-12}
                        offsetX={15}
                    />
                </Group>

                {/* Height Dimension Line (Right) */}
                <Group x={area.width + dimOffset}>
                    <Line points={[0, 0, 0, area.height]} stroke="#64748b" strokeWidth={0.8} />
                    {/* Ticks */}
                    <Line points={[-tickLen, -tickLen, tickLen, tickLen]} stroke="#64748b" strokeWidth={1} />
                    <Line points={[-tickLen, area.height - tickLen, tickLen, area.height + tickLen]} stroke="#64748b" strokeWidth={1} />
                    <Text
                        text={`${(absHeight / SCALE).toFixed(2)}m`}
                        fontSize={9}
                        fill="#475569"
                        x={4}
                        y={area.height / 2}
                        rotation={90}
                        offsetX={15}
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

        return (
            <Group x={opening.x} y={opening.y}>
                <Rect
                    width={opening.width}
                    height={opening.height}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
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
                    strokeWidth={2}
                />
                <Line
                    points={[0, opening.height, opening.width, 0]}
                    stroke="white"
                    strokeWidth={2}
                />
                <Text
                    text={label}
                    fontSize={14}
                    fill="white"
                    fontStyle="bold"
                    align="center"
                    width={opening.width}
                    y={opening.height / 2 - 7}
                />
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
        const count = Math.ceil((lengthPx / SCALE) / unitLength);
        const angle = Math.atan2(dy, dx);
        const tickLen = 6;

        return (
            <Group>
                {/* Main segment */}
                <Line
                    points={[list.x1, list.y1, list.x2, list.y2]}
                    stroke={color}
                    strokeWidth={2}
                    onClick={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                />

                {/* Architectural Ticks */}
                <Line
                    points={[
                        list.x1 - Math.cos(angle + Math.PI / 4) * tickLen, list.y1 - Math.sin(angle + Math.PI / 4) * tickLen,
                        list.x1 + Math.cos(angle + Math.PI / 4) * tickLen, list.y1 + Math.sin(angle + Math.PI / 4) * tickLen
                    ]}
                    stroke={color}
                    strokeWidth={1.5}
                />
                <Line
                    points={[
                        list.x2 - Math.cos(angle + Math.PI / 4) * tickLen, list.y2 - Math.sin(angle + Math.PI / 4) * tickLen,
                        list.x2 + Math.cos(angle + Math.PI / 4) * tickLen, list.y2 + Math.sin(angle + Math.PI / 4) * tickLen
                    ]}
                    stroke={color}
                    strokeWidth={1.5}
                />

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
    }, [designAreas, openings, lists, currentDrawingArea, currentDrawingList, clipFunc, interactionMode]);

    const handleMouseDown = (e: any) => {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

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
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        if (!pos) return;

        if (currentDrawingList) {
            updateList(pos.x, pos.y);
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

    if (!mounted) return <div className="w-full h-[600px] bg-[#fdfbf7] flex items-center justify-center">Loading Editor...</div>;

    const gridSize = 50;
    const gridLines = [];
    for (let i = 0; i < 900 / gridSize; i++) {
        gridLines.push(<Line key={`v-${i}`} points={[i * gridSize, 0, i * gridSize, 600]} stroke="#e2e8f0" strokeWidth={1} />);
    }
    for (let i = 0; i < 600 / gridSize; i++) {
        gridLines.push(<Line key={`h-${i}`} points={[0, i * gridSize, 900, i * gridSize]} stroke="#e2e8f0" strokeWidth={1} />);
    }

    return (
        <div className="relative border-2 border-slate-300 rounded-lg overflow-hidden bg-[#fdfbf7] shadow-xl">
            <Stage
                width={900}
                height={600}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: isClosed ? 'default' : 'crosshair' }}
            >
                <Layer>
                    {gridLines}
                    {!isClosed && (
                        <Text text="Click to place corners. Click start point to close." x={20} y={20} fill="#64748b" fontStyle="italic" />
                    )}

                    {isClosed && renderedAreas}

                    <Line
                        points={flattenedPoints}
                        stroke="#0f172a"
                        strokeWidth={1.5}
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

                        // Calculate normal for dimension line offset
                        // We want to point "outside". For now we'll use a simple approach:
                        // point away from the centroid of the points.
                        const midX = (point.x + nextPoint.x) / 2;
                        const midY = (point.y + nextPoint.y) / 2;

                        const centerX = bounds.minX + bounds.width / 2;
                        const centerY = bounds.minY + bounds.height / 2;

                        let nx = -dy / lengthPx;
                        let ny = dx / lengthPx;

                        // If (mid + normal) is closer to center than (mid), flip it
                        const distWithNormal = Math.hypot(midX + nx * 10 - centerX, midY + ny * 10 - centerY);
                        const distWithoutNormal = Math.hypot(midX - centerX, midY - centerY);
                        if (distWithNormal < distWithoutNormal) {
                            nx = -nx;
                            ny = -ny;
                        }

                        const offset = 40;
                        const dimX1 = point.x + nx * offset;
                        const dimY1 = point.y + ny * offset;
                        const dimX2 = nextPoint.x + nx * offset;
                        const dimY2 = nextPoint.y + ny * offset;

                        // Architectural Tick angle
                        const tickLen = 6;
                        const angle = Math.atan2(dy, dx);

                        return (
                            <Group key={`dim-${i}`} onClick={() => handleLabelClick(i, lengthM)}>
                                {/* Extension Lines */}
                                <Line
                                    points={[point.x + nx * 5, point.y + ny * 5, point.x + nx * (offset + 10), point.y + ny * (offset + 10)]}
                                    stroke="#94a3b8"
                                    strokeWidth={1}
                                />
                                <Line
                                    points={[nextPoint.x + nx * 5, nextPoint.y + ny * 5, nextPoint.x + nx * (offset + 10), nextPoint.y + ny * (offset + 10)]}
                                    stroke="#94a3b8"
                                    strokeWidth={1}
                                />

                                {/* Dimension Line */}
                                <Line
                                    points={[dimX1, dimY1, dimX2, dimY2]}
                                    stroke="#475569"
                                    strokeWidth={1}
                                />

                                {/* Architectural Ticks */}
                                <Line
                                    points={[
                                        dimX1 - Math.cos(angle + Math.PI / 4) * tickLen, dimY1 - Math.sin(angle + Math.PI / 4) * tickLen,
                                        dimX1 + Math.cos(angle + Math.PI / 4) * tickLen, dimY1 + Math.sin(angle + Math.PI / 4) * tickLen
                                    ]}
                                    stroke="#475569"
                                    strokeWidth={1.5}
                                />
                                <Line
                                    points={[
                                        dimX2 - Math.cos(angle + Math.PI / 4) * tickLen, dimY2 - Math.sin(angle + Math.PI / 4) * tickLen,
                                        dimX2 + Math.cos(angle + Math.PI / 4) * tickLen, dimY2 + Math.sin(angle + Math.PI / 4) * tickLen
                                    ]}
                                    stroke="#475569"
                                    strokeWidth={1.5}
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
                                    />
                                )}
                            </Group>
                        );
                    })}

                    {points.map((point, i) => (
                        <Rect
                            key={i}
                            x={point.x - 4}
                            y={point.y - 4}
                            width={8}
                            height={8}
                            fill="white"
                            stroke="#0f172a"
                            strokeWidth={1}
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
                    const p1 = points[editingIndex];
                    const p2 = points[(editingIndex + 1) % points.length];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
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
                                left: midX - 40,
                                top: midY - 15,
                                width: 60,
                                zIndex: 10
                            }}
                        />
                    );
                })()
            )}
        </div>
    );
};

export default WallEditor;
