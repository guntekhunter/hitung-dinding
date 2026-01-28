"use client";

import { useCanvasStore, PRODUCTS, SCALE } from "../store/useCanvasStore";
import { countPanels, countBoards } from "../function/materialEngine";

export default function Toolbar() {
    const {
        getDimensions, reset, isClosed,
        selectedProductId, setSelectedProduct,
        designAreas, clearDesignAreas,
        interactionMode, setInteractionMode
    } = useCanvasStore();
    const { area, perimeter } = getDimensions();

    // Calculate product totals
    const productCounts = designAreas.reduce((acc, designArea) => {
        const product = PRODUCTS.find(p => p.id === designArea.productId);
        if (product) {
            const panelWidthPx = product.width * SCALE;
            const count = Math.ceil(Math.abs(designArea.width) / panelWidthPx);
            acc[designArea.productId] = (acc[designArea.productId] || 0) + count;
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
                        <StatCard label="Total Area" value={`${area.toFixed(2)} m²`} icon="📐" />

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
