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

        return (
            <Group x={area.x} y={area.y}>
                <Rect
                    name="design-area"
                    width={area.width}
                    height={area.height}
                    fill={product.color}
                    stroke="#1e293b"
                    strokeWidth={1}
                    onClick={() => {
                        if (interactionMode === 'delete') removeDesignArea(area.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeDesignArea(area.id);
                    }}
                />
                <Group clipFunc={(ctx) => {
                    ctx.rect(0, 0, area.width, area.height);
                }}>
                    {lines}
                </Group>
                <Text
                    text={`${product.name}\n${count} pcs`}
                    fontSize={12}
                    fill="#1e293b"
                    fontStyle="bold"
                    x={5}
                    y={5}
                    align="center"
                />
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
        const length = Math.hypot(list.x2 - list.x1, list.y2 - list.y1);
        const midX = (list.x1 + list.x2) / 2;
        const midY = (list.y1 + list.y2) / 2;
        const count = Math.ceil((length / SCALE) / 2.9);

        return (
            <Group>
                <Line
                    points={[list.x1, list.y1, list.x2, list.y2]}
                    stroke="#8b5cf6"
                    strokeWidth={10}
                    lineCap="round"
                    onClick={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                    onTap={() => {
                        if (interactionMode === 'delete') removeList(list.id);
                    }}
                />
                <Rect
                    x={midX - 30}
                    y={midY - 10}
                    width={60}
                    height={20}
                    fill="rgba(255, 255, 255, 0.8)"
                    cornerRadius={4}
                />
                <Text
                    x={midX}
                    y={midY}
                    text={`${(length / SCALE).toFixed(2)}m (${count})`}
                    fontSize={10}
                    fill="#5b21b6"
                    offsetX={30}
                    offsetY={5}
                    align="center"
                    width={60}
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

    if (!mounted) return <div className="w-full h-[600px] bg-gray-100 flex items-center justify-center">Loading Editor...</div>;

    return (
        <div className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner">
            <Stage
                width={900}
                height={600}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: isClosed ? 'default' : 'crosshair' }}
            >
                <Layer>
                    {!isClosed && (
                        <Text text="Click to place corners. Click start point to close." x={20} y={20} fill="gray" />
                    )}

                    {isClosed && renderedAreas}

                    <Line
                        points={flattenedPoints}
                        stroke="#0ea5e9"
                        strokeWidth={3}
                        closed={isClosed}
                        fill={isClosed ? "rgba(14, 165, 233, 0.05)" : undefined}
                    />

                    {/* Measurements */}
                    {points.map((point, i) => {
                        if (i === points.length - 1 && !isClosed) return null;

                        const nextPoint = points[(i + 1) % points.length];
                        const midX = (point.x + nextPoint.x) / 2;
                        const midY = (point.y + nextPoint.y) / 2;
                        const lengthPx = Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y);
                        const lengthM = (lengthPx / SCALE).toFixed(2);
                        const isEditing = editingIndex === i;

                        return (
                            <Group key={`label-${i}`} onClick={() => handleLabelClick(i, lengthM)}>
                                {!isEditing && (
                                    <>
                                        <Rect
                                            x={midX - 25}
                                            y={midY - 12}
                                            width={50}
                                            height={24}
                                            fill="rgba(255,255,255,0.8)"
                                            cornerRadius={4}
                                        />
                                        <Text
                                            x={midX}
                                            y={midY}
                                            text={`${lengthM}m`}
                                            fontSize={12}
                                            fill="#0f172a"
                                            offsetX={15}
                                            offsetY={6}
                                        />
                                    </>
                                )}
                            </Group>
                        );
                    })}

                    {points.map((point, i) => (
                        <Circle
                            key={i}
                            x={point.x}
                            y={point.y}
                            radius={6}
                            fill="white"
                            stroke="#0284c7"
                            strokeWidth={2}
                            draggable
                            onDragMove={(e) => handleDragMove(e, i)}
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
