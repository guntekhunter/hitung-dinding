"use client";

import { useCanvasStore, PRODUCTS, SCALE, Wall } from "../store/useCanvasStore";
import { countPanels, countBoards } from "../function/materialEngine";
import { subtractRect, Rect } from "../function/geometry";
import { generateRAB } from "../utils/rabGenerator";

export default function Toolbar({ wallEditorRef }: { wallEditorRef: any }) {
    const {
        walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName,
        getDimensions, reset,
        selectedProductId, setSelectedProduct,
        interactionMode, setInteractionMode,
        undo, redo, past, future,
        wastePercentage, setWastePercentage,
        customerInfo, setCustomerInfo,
        materialPrices, setMaterialPrice
    } = useCanvasStore();

    const activeWall = walls.find(w => w.id === activeWallId) || walls[0];
    const { isClosed, designAreas, openings, lists, isWallLocked } = activeWall;
    const { area, perimeter } = getDimensions(activeWallId || undefined);

    // Helper to calculate materials for a single wall
    const calculateWallMaterials = (wall: Wall) => {
        const wallProductAreas: Record<string, number> = {};
        const wallProductLengths: Record<string, number> = {};
        const wallMouldingBreakdown: Record<string, { segmentLengths: number[], totalSticksNoWaste: number }> = {};
        const wallAreaBreakdown: Record<string, { areas: { width: number, height: number, sticks: number }[], totalSticksNoWaste: number }> = {};
        let wallDesignArea = 0;

        const wallLeftovers: Record<string, number[]> = {};

        wall.designAreas.forEach((da: any, index: number) => {
            const product = PRODUCTS.find(p => p.id === da.productId);
            const isLengthBased = product?.countType === 'length';

            const rect: Rect = {
                x: da.width > 0 ? da.x : da.x + da.width,
                y: da.height > 0 ? da.y : da.y + da.height,
                width: Math.abs(da.width),
                height: Math.abs(da.height)
            };

            if (isLengthBased) {
                const segments = [rect.width / SCALE, rect.height / SCALE, rect.width / SCALE, rect.height / SCALE];
                wallProductLengths[da.productId] = (wallProductLengths[da.productId] || 0) + (rect.width * 2 + rect.height * 2) / SCALE;

                if (!wallMouldingBreakdown[da.productId]) {
                    wallMouldingBreakdown[da.productId] = { segmentLengths: [], totalSticksNoWaste: 0 };
                }

                if (!wallLeftovers[da.productId]) wallLeftovers[da.productId] = [];
                const pool = wallLeftovers[da.productId];
                const unitLen = product.unitLength || 2.9;

                segments.forEach(len => {
                    if (len > 0) {
                        wallMouldingBreakdown[da.productId].segmentLengths.push(len);

                        let needed = len;
                        while (needed > 0.001) {
                            pool.sort((a, b) => a - b);
                            const foundIdx = pool.findIndex(l => l >= needed - 0.001);
                            if (foundIdx !== -1) {
                                pool[foundIdx] -= needed;
                                if (pool[foundIdx] < 0.01) pool.splice(foundIdx, 1);
                                needed = 0;
                            } else {
                                wallMouldingBreakdown[da.productId].totalSticksNoWaste++;
                                const used = Math.min(needed, unitLen);
                                const leftover = unitLen - used;
                                if (leftover > 0.01) pool.push(leftover);
                                needed -= used;
                            }
                        }
                    }
                });
            } else {
                let currentRects: Rect[] = [rect];
                wall.openings.forEach((op: any) => {
                    const opRect: Rect = {
                        x: op.width > 0 ? op.x : op.x + op.width,
                        y: op.height > 0 ? op.y : op.y + op.height,
                        width: Math.abs(op.width),
                        height: Math.abs(op.height)
                    };
                    const nextRects: Rect[] = [];
                    currentRects.forEach(r => nextRects.push(...subtractRect(r, opRect)));
                    currentRects = nextRects;
                });

                for (let i = index + 1; i < wall.designAreas.length; i++) {
                    const topDA = wall.designAreas[i];
                    const topRect: Rect = {
                        x: topDA.width > 0 ? topDA.x : topDA.x + topDA.width,
                        y: topDA.height > 0 ? topDA.y : topDA.y + topDA.height,
                        width: Math.abs(topDA.width),
                        height: Math.abs(topDA.height)
                    };
                    const nextRects: Rect[] = [];
                    currentRects.forEach(r => nextRects.push(...subtractRect(r, topRect)));
                    currentRects = nextRects;
                }

                let areaPx = 0;
                currentRects.forEach(r => areaPx += r.width * r.height);
                const areaM2 = areaPx / (SCALE * SCALE);

                if (da.productId && product) {
                    wallProductAreas[da.productId] = (wallProductAreas[da.productId] || 0) + areaM2;
                    wallDesignArea += areaM2;

                    if (!wallAreaBreakdown[da.productId]) {
                        wallAreaBreakdown[da.productId] = { areas: [], totalSticksNoWaste: 0 };
                    }

                    if (!wallLeftovers[da.productId]) wallLeftovers[da.productId] = [];

                    const wM = Math.abs(da.width) / SCALE;
                    const hM = Math.abs(da.height) / SCALE;
                    const boardH = product.height || 2.9;
                    const boardW = product.width || 1;
                    const columns = Math.ceil(wM / boardW - 0.001); // Use small epsilon for floating point errors

                    let totalSticksUsedForThisArea = 0;
                    const pool = wallLeftovers[da.productId];

                    // Apply waste percentage to the required height for each column
                    const heightWithWaste = hM * (1 + wastePercentage / 100);

                    for (let c = 0; c < columns; c++) {
                        let needed = heightWithWaste;
                        while (needed > 0.001) {
                            pool.sort((a, b) => a - b); // Smallest that fits
                            const foundIdx = pool.findIndex(l => l >= needed - 0.001);

                            if (foundIdx !== -1) {
                                pool[foundIdx] -= needed;
                                if (pool[foundIdx] < 0.01) pool.splice(foundIdx, 1);
                                needed = 0;
                            } else {
                                // Use a new stick
                                totalSticksUsedForThisArea++;
                                const used = Math.min(needed, boardH);
                                const leftover = boardH - used;
                                if (leftover > 0.01) pool.push(leftover);
                                needed -= used;
                            }
                        }
                    }

                    wallAreaBreakdown[da.productId].areas.push({ width: wM, height: hM, sticks: totalSticksUsedForThisArea });
                    wallAreaBreakdown[da.productId].totalSticksNoWaste += totalSticksUsedForThisArea;
                }
            }
        });

        wall.lists.forEach((list: any) => {
            const lengthM = Math.hypot(list.x2 - list.x1, list.y2 - list.y1) / SCALE;
            wallProductLengths[list.productId] = (wallProductLengths[list.productId] || 0) + lengthM;

            if (!wallMouldingBreakdown[list.productId]) {
                wallMouldingBreakdown[list.productId] = { segmentLengths: [], totalSticksNoWaste: 0 };
            }
            if (!wallLeftovers[list.productId]) wallLeftovers[list.productId] = [];
            const pool = wallLeftovers[list.productId];
            const product = PRODUCTS.find(p => p.id === list.productId);
            const unitLen = product?.unitLength || 2.9;

            wallMouldingBreakdown[list.productId].segmentLengths.push(lengthM);

            let needed = lengthM;
            while (needed > 0.001) {
                pool.sort((a, b) => a - b);
                const foundIdx = pool.findIndex(l => l >= needed - 0.001);
                if (foundIdx !== -1) {
                    pool[foundIdx] -= needed;
                    if (pool[foundIdx] < 0.01) pool.splice(foundIdx, 1);
                    needed = 0;
                } else {
                    wallMouldingBreakdown[list.productId].totalSticksNoWaste++;
                    const used = Math.min(needed, unitLen);
                    const leftover = unitLen - used;
                    if (leftover > 0.01) pool.push(leftover);
                    needed -= used;
                }
            }
        });

        const counts = PRODUCTS.reduce((acc, product) => {
            if (product.countType === 'length') {
                const totalLength = wallProductLengths[product.id] || 0;
                const totalWithWaste = totalLength * (1 + wastePercentage / 100);
                acc[product.id] = Math.ceil(totalWithWaste / (product.unitLength || 2.9));
            } else {
                const breakdown = wallAreaBreakdown[product.id];
                acc[product.id] = breakdown ? breakdown.totalSticksNoWaste : 0;
            }
            return acc;
        }, {} as Record<string, number>);

        const { area: wallArea } = getDimensions(wall.id);

        return {
            counts,
            totalDesignArea: wallDesignArea,
            wallArea,
            areaBreakdown: wallAreaBreakdown,
            mouldingBreakdown: wallMouldingBreakdown,
            productAreas: wallProductAreas,
            productLengths: wallProductLengths
        };
    };

    const wallCalculations = walls.map(calculateWallMaterials);

    // Total counts across all walls
    const totalProductCounts = PRODUCTS.reduce((acc, product) => {
        acc[product.id] = wallCalculations.reduce((sum, calc) => sum + (calc.counts[product.id] || 0), 0);
        return acc;
    }, {} as Record<string, number>);

    const totalArea = wallCalculations.reduce((sum, calc) => sum + calc.wallArea, 0);
    const totalDesignArea = wallCalculations.reduce((sum, calc) => sum + calc.totalDesignArea, 0);

    const handleExport = () => {
        if (!wallEditorRef.current) return;
        const stage = wallEditorRef.current.getStage();
        if (!stage) return;

        // 1. Get Stage Image (Data URL)
        // We temporarily hide things we don't want in the export if necessary,
        // but Konva Stage.toDataURL() is quite flexible.
        const dataURL = stage.toDataURL({ pixelRatio: 2 }); // High res

        // 2. Create a temporary canvas to combine drawing + text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            const padding = 40;
            const rowHeight = 30;
            const headerHeight = 60;
            const footerHeight = headerHeight + (PRODUCTS.length + 2) * rowHeight + padding * 2;

            canvas.width = img.width;
            canvas.height = img.height + footerHeight;

            // Fill background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Stage Image
            ctx.drawImage(img, 0, 0);

            // Draw Divider
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, img.height);
            ctx.lineTo(canvas.width, img.height);
            ctx.stroke();

            // Draw Bill of Materials Header
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Bill of Materials', padding, img.height + padding + 20);

            ctx.font = '16px Arial';
            ctx.fillStyle = '#64748b';
            ctx.fillText(`Total Wall Area: ${Math.ceil(area)} m²`, padding, img.height + padding + 55);
            ctx.fillText(`Total Design Area: ${Math.ceil(totalDesignArea)} m²`, padding, img.height + padding + 80);

            // Draw Material Table
            let currentY = img.height + padding + 120;
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#334155';

            PRODUCTS.forEach((product) => {
                const count = totalProductCounts[product.id] || 0;
                if (count > 0) {
                    ctx.fillStyle = '#334155';
                    ctx.fillText(product.name, padding, currentY);

                    ctx.fillStyle = '#4f46e5';
                    const countText = `${count} ${product.countType === 'length' ? 'btg' : 'pcs'}`;
                    const metrics = ctx.measureText(countText);
                    ctx.fillText(countText, canvas.width - padding - metrics.width, currentY);

                    currentY += rowHeight;
                }
            });

            // Trigger Download
            const link = document.createElement('a');
            link.download = `wall-plan-${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = dataURL;
    };

    return (
        <div style={{
            padding: "24px",
            borderLeft: "1px solid #e2e8f0",
            width: "350px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "-4px 0 15px rgba(0,0,0,0.05)",
            overflowY: "auto",
            maxHeight: "100vh"
        }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b", margin: 0 }}>
                Wall Planner
            </h1>

            {/* Wall Manager */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#fff", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em", margin: 0 }}>
                        Walls
                    </h3>
                    <button
                        onClick={addWall}
                        style={{
                            padding: "4px 8px",
                            background: "#4f46e5",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "bold"
                        }}
                    >
                        + New Wall
                    </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {walls.map(wall => (
                        <div
                            key={wall.id}
                            onClick={() => setActiveWall(wall.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px",
                                background: activeWallId === wall.id ? "#f1f5f9" : "transparent",
                                borderRadius: "8px",
                                cursor: "pointer",
                                border: activeWallId === wall.id ? "1px solid #cbd5e1" : "1px solid transparent",
                                transition: "all 0.2s"
                            }}
                        >
                            <input
                                value={wall.name}
                                onChange={(e) => updateWallName(wall.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    flex: 1,
                                    background: "transparent",
                                    border: "none",
                                    fontSize: "14px",
                                    fontWeight: activeWallId === wall.id ? "bold" : "normal",
                                    color: "#1e293b",
                                    outline: "none"
                                }}
                            />
                            {walls.length > 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeWall(wall.id); }}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#94a3b8",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        padding: "2px"
                                    }}
                                >
                                    🗑️
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Customer Information */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#fff", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.05em", margin: 0 }}>
                    Customer Information
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                        placeholder="Customer Name"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                        style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px" }}
                    />
                    <input
                        placeholder="Phone Number"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                        style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px" }}
                    />
                    <textarea
                        placeholder="Address"
                        value={customerInfo.address}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                        style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "13px", minHeight: "60px", resize: "vertical" }}
                    />
                </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                <button
                    onClick={reset}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: "#ef4444",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600",
                        transition: "opacity 0.2s"
                    }}
                >
                    🔄 Clear Wall
                </button>
                <button
                    onClick={() => useCanvasStore.getState().toggleWallLock()}
                    disabled={!isClosed}
                    style={{
                        flex: 1,
                        padding: "10px",
                        background: isWallLocked ? "#4b5563" : "white",
                        color: isWallLocked ? "white" : "#4b5563",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        cursor: isClosed ? "pointer" : "not-allowed",
                        fontWeight: "600",
                        opacity: isClosed ? 1 : 0.5,
                        transition: "all 0.2s"
                    }}
                >
                    {isWallLocked ? "🔒 Unlock Wall" : "🔓 Lock Wall"}
                </button>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                <button
                    onClick={undo}
                    disabled={past.length === 0}
                    style={{
                        flex: 1,
                        padding: "8px",
                        background: past.length === 0 ? "#e2e8f0" : "white",
                        color: past.length === 0 ? "#94a3b8" : "#475569",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        cursor: past.length === 0 ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                    }}
                >
                    ↩️ Undo
                </button>
                <button
                    onClick={redo}
                    disabled={future.length === 0}
                    style={{
                        flex: 1,
                        padding: "8px",
                        background: future.length === 0 ? "#e2e8f0" : "white",
                        color: future.length === 0 ? "#94a3b8" : "#475569",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        cursor: future.length === 0 ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                    }}
                >
                    ↪️ Redo
                </button>
            </div>

            <hr style={{ border: "0", borderTop: "1px solid #e2e8f0", margin: "10px 0" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                    Tool Mode
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setInteractionMode('place')}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'place' ? "#4f46e5" : "white",
                            color: interactionMode === 'place' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        ➕ Place
                    </button>
                    <button
                        onClick={() => setInteractionMode('delete')}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'delete' ? "#ef4444" : "white",
                            color: interactionMode === 'delete' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                    Select Product
                </h3>
                {PRODUCTS.map(product => (
                    <button
                        key={product.id}
                        onClick={() => {
                            setSelectedProduct(product.id);
                            // Automatically switch back to a drawing mode when selecting a product
                            if (product.countType === 'length') {
                                setInteractionMode('list');
                            } else {
                                setInteractionMode('place');
                            }
                        }}
                        style={{
                            padding: "12px",
                            background: selectedProductId === product.id ? "#4f46e5" : "white",
                            color: selectedProductId === product.id ? "white" : "#1e293b",
                            border: "1px solid #e2e8f0",
                            borderRadius: "10px",
                            cursor: "pointer",
                            textAlign: "left",
                            fontWeight: selectedProductId === product.id ? "bold" : "normal",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}
                    >
                        <span>{product.name}</span>
                        <div style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "3px",
                            background: product.color,
                            border: "1px solid rgba(0,0,0,0.1)"
                        }} />
                    </button>
                ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                    Add Extras
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setInteractionMode('window')}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'window' ? "#0ea5e9" : "white",
                            color: interactionMode === 'window' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        🪟 Window
                    </button>
                    <button
                        onClick={() => setInteractionMode('door')}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'door' ? "#d97706" : "white",
                            color: interactionMode === 'door' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        🚪 Door
                    </button>
                    <button
                        onClick={() => {
                            setSelectedProduct('list');
                            setInteractionMode('list');
                        }}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'list' && selectedProductId === 'list' ? "#8b5cf6" : "white",
                            color: interactionMode === 'list' && selectedProductId === 'list' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        📏 List
                    </button>
                    <button
                        onClick={() => {
                            setSelectedProduct('moulding');
                            setInteractionMode('list');
                        }}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'list' && selectedProductId === 'moulding' ? "#f43f5e" : "white",
                            color: interactionMode === 'list' && selectedProductId === 'moulding' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        🪄 Moulding
                    </button>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                    Waste Percentage (%)
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                        type="number"
                        value={wastePercentage}
                        onChange={(e) => setWastePercentage(Number(e.target.value))}
                        style={{
                            width: "80px",
                            padding: "8px",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            textAlign: "center",
                            fontSize: "14px",
                            fontWeight: "bold",
                            color: "#1e293b"
                        }}
                    />
                    <span style={{ fontSize: "14px", color: "#64748b" }}>Default 10%</span>
                </div>
            </div>

            {isClosed && (
                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        onClick={() => useCanvasStore.getState().clearDesignAreas()}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: "white",
                            color: "#ef4444",
                            border: "1px solid #ef4444",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "600",
                        }}
                    >
                        🗑️ Hapus Semua Material
                    </button>
                </div>
            )}

            <hr style={{ border: "0", borderTop: "1px solid #e2e8f0", margin: "10px 0" }} />

            <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: "16px", fontWeight: "bold", color: "#475569", textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>
                    Bill of Materials
                </h3>

                {!isClosed ? (
                    <div style={{
                        padding: "20px",
                        background: "#fff",
                        borderRadius: "12px",
                        border: "1px dashed #cbd5e1",
                        textAlign: "center",
                        color: "#64748b"
                    }}>
                        <p style={{ margin: 0 }}>Klik area dinding untuk memulai</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        {/* Overall Totals */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <h4 style={{ fontSize: "12px", color: "#64748b", margin: "0 0 4px 0" }}>OVERALL SUMMARY</h4>
                            <StatCard label="Total Area (All Walls)" value={`${Math.ceil(totalArea)} m²`} icon="📐" />
                            <StatCard label="Total Design (All Walls)" value={`${Math.ceil(totalDesignArea)} m²`} icon="🎯" />

                            <div style={{ marginTop: "8px", background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                <h5 style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", marginBottom: "8px" }}>TOTAL MATERIALS</h5>
                                {PRODUCTS.map(product => {
                                    const count = totalProductCounts[product.id] || 0;
                                    if (count === 0) return null;
                                    const price = materialPrices[product.id] || 0;
                                    return (
                                        <div key={product.id} style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#1e293b" }}>
                                                <span>{product.name}</span>
                                                <span style={{ fontWeight: "bold", color: "#4f46e5" }}>{count} {product.countType === 'length' ? 'btg' : 'pcs'}</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "11px", color: "#64748b" }}>Rp</span>
                                                <input
                                                    type="number"
                                                    value={price}
                                                    onChange={(e) => setMaterialPrice(product.id, Number(e.target.value))}
                                                    placeholder="Input price"
                                                    style={{
                                                        flex: 1,
                                                        padding: "4px 8px",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "6px",
                                                        fontSize: "12px",
                                                        background: "#fff"
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-Wall Breakdown */}
                        {walls.map((wall, wallIdx) => {
                            const calc = wallCalculations[wallIdx];
                            const wallHasContent = Object.values(calc.counts).some(c => c > 0);

                            return (
                                <div key={wall.id} style={{ borderTop: "2px solid #e2e8f0", paddingTop: "16px" }}>
                                    <h4 style={{ fontWeight: "bold", color: "#1e293b", fontSize: "14px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ background: "#4f46e5", color: "white", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>{wallIdx + 1}</span>
                                        {wall.name}
                                    </h4>

                                    {!wall.isClosed ? (
                                        <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Wall not closed yet</div>
                                    ) : !wallHasContent ? (
                                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>No materials placed</div>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                            {PRODUCTS.map(product => {
                                                const count = calc.counts[product.id] || 0;
                                                if (count === 0) return null;
                                                const mBreakdown = calc.mouldingBreakdown[product.id];
                                                const aBreakdown = calc.areaBreakdown[product.id];
                                                const totalValue = product.countType === 'length' ? (calc.productLengths[product.id] || 0) : (calc.productAreas[product.id] || 0);
                                                const unit = product.countType === 'length' ? "btg" : "pcs";

                                                return (
                                                    <div key={product.id}>
                                                        <MaterialItem
                                                            label={product.name}
                                                            sub={product.countType === 'length' ? `${product.unitLength}m length` : `${(product.width * 100).toFixed(0)}cm x ${product.height}m`}
                                                            count={count}
                                                            unit={unit}
                                                        />
                                                        <div style={{
                                                            fontSize: "10px",
                                                            color: "#64748b",
                                                            background: "#f1f5f9",
                                                            padding: "6px",
                                                            borderRadius: "6px",
                                                            marginTop: "2px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            gap: "1px"
                                                        }}>
                                                            {product.countType === 'length' ? (
                                                                <>
                                                                    <div>📏 Panjang: <b>{totalValue.toFixed(2)}m</b></div>
                                                                    {mBreakdown && <div>📦 Batang/sisi: {mBreakdown.segmentLengths.map(l => Math.ceil(l / 2.9)).join(', ')}</div>}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div>📐 Luas: <b>{totalValue.toFixed(2)}m²</b></div>
                                                                    {aBreakdown && <div>📦 Batang/area: {aBreakdown.areas.map(a => a.sticks).join(', ')}</div>}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>


            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                    onClick={handleExport}
                    disabled={!isClosed}
                    style={{
                        padding: "14px",
                        background: isClosed ? "white" : "#e2e8f0",
                        color: isClosed ? "#1e293b" : "#94a3b8",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        cursor: isClosed ? "pointer" : "not-allowed",
                        fontWeight: "bold",
                        fontSize: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                    }}
                >
                    🖼️ Export Plan (PNG)
                </button>
                <button
                    onClick={async () => {
                        try {
                            await generateRAB(walls, customerInfo, wastePercentage, calculateWallMaterials, materialPrices);
                        } catch (e) {
                            alert("Gagal membuat RAB: " + e);
                        }
                    }}
                    disabled={!isClosed}
                    style={{
                        padding: "14px",
                        background: isClosed ? "#1e293b" : "#94a3b8",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: isClosed ? "pointer" : "not-allowed",
                        fontWeight: "bold",
                        fontSize: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                    }}
                >
                    📑 Export RAB (PDF)
                </button>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: string }) {
    return (
        <div style={{
            padding: "12px 16px",
            background: "white",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: "12px"
        }}>
            <span style={{ fontSize: "20px" }}>{icon}</span>
            <div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1e293b" }}>{value}</div>
            </div>
        </div>
    );
}

function MaterialItem({ label, sub, count, unit }: { label: string, sub: string, count: number, unit: string }) {
    return (
        <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid #f1f5f9"
        }}>
            <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>{label}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>{sub}</div>
            </div>
            <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#4f46e5" }}>{count}</span>
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>{unit}</span>
            </div>
        </div>
    );
}
