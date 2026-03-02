"use client";

import { useCanvasStore, PRODUCTS, SCALE } from "../store/useCanvasStore";
import { countPanels, countBoards } from "../function/materialEngine";
import { subtractRect, Rect } from "../function/geometry";

export default function Toolbar({ wallEditorRef }: { wallEditorRef: any }) {
    const {
        getDimensions, reset, isClosed,
        selectedProductId, setSelectedProduct,
        designAreas, clearDesignAreas,
        interactionMode, setInteractionMode,
        openings, lists,
        undo, redo, past, future,
        isWallLocked, toggleWallLock,
        wastePercentage, setWastePercentage
    } = useCanvasStore();
    const { area, perimeter } = getDimensions();

    // Calculate total area per product and total design area
    const productAreas: Record<string, number> = {};
    const productLengths: Record<string, number> = {};
    const mouldingBreakdown: Record<string, { segmentLengths: number[], totalSticksNoWaste: number }> = {};
    const areaBreakdown: Record<string, { areas: { width: number, height: number, sticks: number }[], totalSticksNoWaste: number }> = {};
    let totalDesignArea = 0;

    designAreas.forEach((da, index) => {
        const product = PRODUCTS.find(p => p.id === da.productId);
        const isLengthBased = product?.countType === 'length';

        const rect: Rect = {
            x: da.width > 0 ? da.x : da.x + da.width,
            y: da.height > 0 ? da.y : da.y + da.height,
            width: Math.abs(da.width),
            height: Math.abs(da.height)
        };

        if (isLengthBased) {
            // For moulding rectangles, we count the perimeter as 4 segments (for more accuracy)
            const segments = [rect.width / SCALE, rect.height / SCALE, rect.width / SCALE, rect.height / SCALE];
            productLengths[da.productId] = (productLengths[da.productId] || 0) + (rect.width * 2 + rect.height * 2) / SCALE;

            if (!mouldingBreakdown[da.productId]) {
                mouldingBreakdown[da.productId] = { segmentLengths: [], totalSticksNoWaste: 0 };
            }
            segments.forEach(len => {
                if (len > 0) {
                    mouldingBreakdown[da.productId].segmentLengths.push(len);
                    mouldingBreakdown[da.productId].totalSticksNoWaste += Math.ceil(len / 2.9);
                }
            });
        } else {
            let currentRects: Rect[] = [rect];

            openings.forEach(op => {
                const opRect: Rect = {
                    x: op.width > 0 ? op.x : op.x + op.width,
                    y: op.height > 0 ? op.y : op.y + op.height,
                    width: Math.abs(op.width),
                    height: Math.abs(op.height)
                };

                const nextRects: Rect[] = [];
                currentRects.forEach(r => {
                    nextRects.push(...subtractRect(r, opRect));
                });
                currentRects = nextRects;
            });

            for (let i = index + 1; i < designAreas.length; i++) {
                const topDA = designAreas[i];
                const topRect: Rect = {
                    x: topDA.width > 0 ? topDA.x : topDA.x + topDA.width,
                    y: topDA.height > 0 ? topDA.y : topDA.y + topDA.height,
                    width: Math.abs(topDA.width),
                    height: Math.abs(topDA.height)
                };

                const nextRects: Rect[] = [];
                currentRects.forEach(r => {
                    nextRects.push(...subtractRect(r, topRect));
                });
                currentRects = nextRects;
            }

            let areaPx = 0;
            currentRects.forEach(r => {
                areaPx += r.width * r.height;
            });

            const areaM2 = areaPx / (SCALE * SCALE);

            if (da.productId && product) {
                productAreas[da.productId] = (productAreas[da.productId] || 0) + areaM2;
                totalDesignArea += areaM2;

                if (!areaBreakdown[da.productId]) {
                    areaBreakdown[da.productId] = { areas: [], totalSticksNoWaste: 0 };
                }

                const wM = Math.abs(da.width) / SCALE;
                const hM = Math.abs(da.height) / SCALE;
                const boardH = product.height || 2.9;
                const boardW = product.width || 1;
                const columns = Math.ceil(wM / boardW);

                let sticksForArea = 0;
                const isStripProduct = da.productId.toLowerCase().includes('wallboard') || da.productId.toLowerCase().includes('uvboard');

                if (isStripProduct) {
                    // Specific logic for wallboard and UV Board (one horizontal line joint)
                    if (hM <= boardH) {
                        sticksForArea = columns;
                    } else {
                        const kekurangan = hM - boardH;
                        const totalStripHeight = columns * kekurangan;
                        const boardTambahan = Math.ceil(totalStripHeight / boardH);
                        sticksForArea = columns + boardTambahan;
                    }
                } else {
                    // Regular piece-based logic for other area products (wallpanels, etc.)
                    const sticksPerColumn = Math.ceil(hM / boardH);
                    sticksForArea = columns * sticksPerColumn;
                }

                areaBreakdown[da.productId].areas.push({ width: wM, height: hM, sticks: sticksForArea });
                areaBreakdown[da.productId].totalSticksNoWaste += sticksForArea;
            }
        }
    });

    lists.forEach(list => {
        const lengthM = Math.hypot(list.x2 - list.x1, list.y2 - list.y1) / SCALE;
        productLengths[list.productId] = (productLengths[list.productId] || 0) + lengthM;

        if (!mouldingBreakdown[list.productId]) {
            mouldingBreakdown[list.productId] = { segmentLengths: [], totalSticksNoWaste: 0 };
        }
        mouldingBreakdown[list.productId].segmentLengths.push(lengthM);
        mouldingBreakdown[list.productId].totalSticksNoWaste += Math.ceil(lengthM / 2.9);
    });

    // Calculate product counts
    const productCounts = PRODUCTS.reduce((acc, product) => {
        if (product.countType === 'length') {
            const totalLength = productLengths[product.id] || 0;
            const totalWithWaste = totalLength * (1 + wastePercentage / 100);
            const finalCount = Math.ceil(totalWithWaste / (product.unitLength || 2.9));
            acc[product.id] = finalCount;
        } else {
            const breakdown = areaBreakdown[product.id];
            if (breakdown) {
                // Apply waste to the total sticks sum
                acc[product.id] = Math.ceil(breakdown.totalSticksNoWaste * (1 + wastePercentage / 100));
            } else {
                acc[product.id] = 0;
            }
        }
        return acc;
    }, {} as Record<string, number>);

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
                const count = productCounts[product.id] || 0;
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
                    onClick={toggleWallLock}
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
                        onClick={clearDesignAreas}
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <StatCard label="Total Wall Area" value={`${Math.ceil(area)} m²`} icon="📐" />
                        <StatCard label="Total Design Area" value={`${Math.ceil(totalDesignArea)} m²`} icon="🎯" />

                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {PRODUCTS.map(product => {
                                const count = productCounts[product.id] || 0;
                                const mBreakdown = mouldingBreakdown[product.id];
                                const aBreakdown = areaBreakdown[product.id];
                                const totalValue = product.countType === 'length' ? (productLengths[product.id] || 0) : (productAreas[product.id] || 0);
                                const unit = product.countType === 'length' ? "btg" : "pcs";

                                return (
                                    <div key={product.id}>
                                        <MaterialItem
                                            label={product.name}
                                            sub={product.countType === 'length' ? `${product.unitLength}m length` : `${(product.width * 100).toFixed(0)}cm x ${product.height}m`}
                                            count={count}
                                            unit={unit}
                                        />
                                        {count > 0 && (
                                            <div style={{
                                                fontSize: "11px",
                                                color: "#64748b",
                                                background: "#f1f5f9",
                                                padding: "8px",
                                                borderRadius: "6px",
                                                marginTop: "4px",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "2px"
                                            }}>
                                                {product.countType === 'length' ? (
                                                    <>
                                                        <div>📏 Total Panjang: <b>{totalValue.toFixed(2)}m</b></div>
                                                        <div>♻️ Dengan Waste ({wastePercentage}%): <b>{(totalValue * (1 + wastePercentage / 100)).toFixed(2)}m</b></div>
                                                        {mBreakdown && (
                                                            <>
                                                                <div>📦 Batang per sisi (Pcs/Side): {mBreakdown.segmentLengths.map(l => Math.ceil(l / 2.9)).join(', ')}</div>
                                                                <div>🔢 Total Batang (Tanpa Waste): <b>{mBreakdown.totalSticksNoWaste} btg</b></div>
                                                            </>
                                                        )}
                                                        <div>✅ Total Batang (Dengan Waste): <b>{count} btg</b></div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>📐 Total Luas: <b>{totalValue.toFixed(2)}m²</b></div>
                                                        <div>♻️ Dengan Waste ({wastePercentage}%): <b>{(totalValue * (1 + wastePercentage / 100)).toFixed(2)}m²</b></div>
                                                        {aBreakdown && (
                                                            <>
                                                                <div>📦 Batang per area (Pcs/Area): {aBreakdown.areas.map(a => a.sticks).join(', ')}</div>
                                                                <div>🔢 Total Batang (Tanpa Waste): <b>{aBreakdown.totalSticksNoWaste} pcs</b></div>
                                                            </>
                                                        )}
                                                        <div>✅ Total Batang (Dengan Waste): <b>{count} pcs</b></div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>


            <button
                onClick={handleExport}
                disabled={!isClosed}
                style={{
                    padding: "14px",
                    background: isClosed ? "#4f46e5" : "#94a3b8",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: isClosed ? "pointer" : "not-allowed",
                    fontWeight: "bold",
                    fontSize: "16px"
                }}
            >
                📥 Export Hasil
            </button>
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
