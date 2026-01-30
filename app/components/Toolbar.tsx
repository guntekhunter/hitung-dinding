"use client";

import { useCanvasStore, PRODUCTS, SCALE } from "../store/useCanvasStore";
import { countPanels, countBoards } from "../function/materialEngine";
import { subtractRect, Rect } from "../function/geometry";

export default function Toolbar() {
    const {
        getDimensions, reset, isClosed,
        selectedProductId, setSelectedProduct,
        designAreas, clearDesignAreas,
        interactionMode, setInteractionMode,
        openings, lists,
        undo, redo, past, future
    } = useCanvasStore();
    const { area, perimeter } = getDimensions();

    // Calculate total area per product and total design area
    // Calculate total area per product and total design area
    // NEW: Robust occlusion logic
    const productAreas: Record<string, number> = {};
    let totalDesignArea = 0;

    designAreas.forEach((da, index) => {
        // Start with the full rectangle area
        // Ensure standard Rect format (positive width/height)
        let currentRects: Rect[] = [{
            x: da.width > 0 ? da.x : da.x + da.width,
            y: da.height > 0 ? da.y : da.y + da.height,
            width: Math.abs(da.width),
            height: Math.abs(da.height)
        }];

        // 1. Subtract Openings (Windows/Doors) - they cut through everything
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

        // 2. Subtract Overlapping Design Areas (only those on top / later in array)
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

        // 3. Sum up the remaining area
        let areaPx = 0;
        currentRects.forEach(r => {
            areaPx += r.width * r.height;
        });

        const areaM2 = areaPx / (SCALE * SCALE);

        if (da.productId) {
            productAreas[da.productId] = (productAreas[da.productId] || 0) + areaM2;
            totalDesignArea += areaM2;
        }
    });

    // Calculate product counts based on total area
    const productCounts = Object.entries(productAreas).reduce((acc, [productId, area]) => {
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
            const unitArea = product.width * product.height;
            acc[productId] = Math.ceil(area / unitArea);
        }
        return acc;
    }, {} as Record<string, number>);

    return (
        <div style={{
            padding: "24px",
            borderRight: "1px solid #e2e8f0",
            width: "350px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "4px 0 15px rgba(0,0,0,0.05)"
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
                        onClick={() => setSelectedProduct(product.id)}
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
                        onClick={() => setInteractionMode('list')}
                        style={{
                            flex: 1,
                            padding: "10px",
                            background: interactionMode === 'list' ? "#8b5cf6" : "white",
                            color: interactionMode === 'list' ? "white" : "#475569",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                        }}
                    >
                        📏 List
                    </button>
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
                        🗑️ Clear Areas
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
                        <p style={{ margin: 0 }}>Start clicking on the canvas to draw your wall. Close the shape to see estimates.</p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <StatCard label="Total Wall Area" value={`${area.toFixed(2)} m²`} icon="📐" />
                        <StatCard label="Total Design Area" value={`${totalDesignArea.toFixed(2)} m²`} icon="🎯" />

                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {PRODUCTS.map(product => (
                                <MaterialItem
                                    key={product.id}
                                    label={product.name}
                                    sub={`${(product.width * 100).toFixed(0)}cm x ${product.height}m`}
                                    count={productCounts[product.id] || 0}
                                    unit="pcs"
                                />
                            ))}
                            {lists.length > 0 && (
                                <MaterialItem
                                    label="List / Molding"
                                    sub="2.90m length"
                                    count={Math.ceil(lists.reduce((acc, l) => acc + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0) / SCALE / 2.9)}
                                    unit="btg"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>


            <button
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
                📥 Export Quote
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
