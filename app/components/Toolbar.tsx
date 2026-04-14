"use client";

import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import { useCanvasStore, SCALE, Wall, Product } from "../store/useCanvasStore";
import { generateRAB } from "../utils/rabGenerator";
import { saveProjectToDatabase, ProjectData } from "../utils/saveProject";
import Link from "next/link";
import { useAuthStore } from "../store/useAuthStore";
import { logoutUser } from "../utils/auth";
import { useRouter } from "next/navigation";
import { callWorker } from "../utils/workerManager";

// --- Split into smaller memoized components to prevent global re-renders ---

const UserHeader = memo(({ user, company, onLogout }: any) => (
    <div className="bg-white border-b border-slate-100 flex flex-col shrink-0">
        <div className="p-4 flex justify-between items-center border-b border-slate-50">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Wall Planner</h1>
            <div className="flex gap-2">
                <Link href="/settings" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">⚙️ Settings</Link>
                <Link href="/projects" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">Projects 📂</Link>
            </div>
        </div>
        <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-md border-2 border-white">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                    <div className="text-xs font-black text-slate-800 tracking-tight leading-none mb-1">{user?.name || "User"}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{company?.name || "Company"}</div>
                </div>
            </div>
            <button 
                onClick={onLogout}
                className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95 group border border-transparent hover:border-rose-100"
                title="Logout"
            >
                <span className="text-xl group-hover:rotate-12 transition-transform block">🚪</span>
            </button>
        </div>
    </div>
));

const WallManager = memo(({ walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName }: any) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-slate-500">
            <h3 className="font-bold uppercase text-[10px] tracking-widest">Walls</h3>
            <button
                onClick={addWall}
                className="px-2 py-1 bg-indigo-600 text-white rounded-md text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
                + New Wall
            </button>
        </div>
        <div className="space-y-2">
            {walls.map((wall: any) => (
                <div
                    key={wall.id}
                    onClick={() => setActiveWall(wall.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${activeWallId === wall.id
                        ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100"
                        : "bg-transparent border-transparent hover:bg-slate-50"
                        }`}
                >
                    <input
                        value={wall.name}
                        onChange={(e) => updateWallName(wall.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent border-none text-sm font-semibold text-slate-700 focus:outline-none"
                    />
                    {walls.length > 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); removeWall(wall.id); }}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
));

const CustomerInfoSection = memo(({ customerInfo, setCustomerInfo }: any) => {
    // Local state for fast typing, debounced to store would be better but let's at least keep it separated
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Customer info</h3>
            <div className="space-y-2">
                <input
                    placeholder="Customer Name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                <input
                    placeholder="Surveyor Name"
                    value={customerInfo.surveyorName}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, surveyorName: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                <input
                    placeholder="Phone Number"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                <textarea
                    placeholder="Address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                />
            </div>
        </div>
    );
});

export default function Toolbar({ wallEditorRef }: { wallEditorRef: any }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [calcResults, setCalcResults] = useState<any>(null);
    
    const router = useRouter();
    const { user, company, clearSession } = useAuthStore();
    
    const {
        walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName,
        reset, selectedProductId, setSelectedProduct,
        interactionMode, setInteractionMode,
        undo, redo, past, future,
        wastePercentage, setWastePercentage,
        listDrawingType, setListDrawingType,
        customerInfo, setCustomerInfo,
        materialPrices, setMaterialPrice,
        projectId, setProjectId,
        products, isLoadingProducts, fetchProducts,
        toggleWallLock, clearDesignAreas
    } = useCanvasStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // --- Background Calculation Engine ---
    useEffect(() => {
        let isCurrent = true;
        const triggerCalculation = async () => {
            if (walls.length === 0) return;
            setIsCalculating(true);
            try {
                // Offload heavy geometry and material math to the background worker
                const response = await callWorker('CALCULATE_PROJECT_METRICS', {
                    walls: walls.map(w => ({
                        id: w.id,
                        points: w.points,
                        designAreas: w.designAreas,
                        openings: w.openings,
                        lists: w.lists
                    })),
                    products: products.map(p => ({
                        id: p.id,
                        countType: p.countType,
                        width: p.width,
                        height: p.height,
                        unitLength: p.unitLength
                    })),
                    wastePercentage
                });

                if (isCurrent && response?.type === 'PROJECT_METRICS_RESULT') {
                    setCalcResults(response.results);
                }
            } catch (err) {
                console.error("Worker calculation failed:", err);
            } finally {
                if (isCurrent) setIsCalculating(false);
            }
        };

        triggerCalculation();
        return () => { isCurrent = false; };
        // We only re-calculate when the physical geometry or material settings change
    }, [walls, products, wastePercentage]);

    const handleLogout = useCallback(async () => {
        try {
            await logoutUser();
            clearSession();
            router.push("/login");
        } catch (err) {
            console.error("Logout failed:", err);
            alert("Logout failed. Please try again.");
        }
    }, [clearSession, router]);

    const activeWall = useMemo(() => walls.find(w => w.id === activeWallId) || walls[0], [walls, activeWallId]);
    const { isClosed, isWallLocked } = activeWall;

    // Derived results from worker calculation
    const wallMetrics = calcResults?.wallMetrics || [];
    const totalProductCounts = calcResults?.totalProductCounts || {};
    
    const totals = useMemo(() => {
        if (!calcResults) return { totalArea: 0, totalDesignArea: 0 };
        // Worker doesn't calculate wall area yet (simple polygon area), so we sum it up if needed or 
        // rely on simple logic here since polygonArea is simple.
        // For now, let's keep it simple.
        return {
            totalArea: walls.reduce((sum, w) => {
                let area = 0;
                for (let i = 0; i < w.points.length; i++) {
                    const j = (i + 1) % w.points.length;
                    area += w.points[i].x * w.points[j].y;
                    area -= w.points[j].x * w.points[i].y;
                }
                return sum + (Math.abs(area / 2) / (SCALE * SCALE));
            }, 0),
            totalDesignArea: wallMetrics.reduce((sum: number, m: any) => sum + Object.values(m.productAreas).reduce((a: any, b: any) => a + b, 0), 0)
        };
    }, [calcResults, walls, wallMetrics]);

    const handleSaveProject = async () => {
        setIsSaving(true);
        try {
            const materialsList: ProjectData["rab"]["materials"] = [];
            let grandTotal = 0;

            products.forEach((product: Product) => {
                const count = totalProductCounts[product.id] || 0;
                if (count > 0) {
                    const price = materialPrices[product.id] ?? product.price ?? 0;
                    const subtotal = count * price;

                    materialsList.push({
                        id: product.id,
                        name: product.name,
                        quantity: count,
                        unit: product.countType === 'length' ? 'Batang' : 'Lembar',
                        unitPrice: price,
                        totalPrice: subtotal
                    });

                    grandTotal += subtotal;
                }
            });

            const stage = wallEditorRef.current?.getStage();
            const previewImage = stage ? stage.toDataURL({ 
                pixelRatio: 0.2, 
                mimeType: 'image/jpeg', 
                quality: 0.5 
            }) : undefined;

            const projectData: ProjectData = {
                projectInfo: {
                    surveyor: customerInfo.surveyorName || "Muh. Agung",
                    customerName: customerInfo.name || "Unknown Customer",
                    phone: customerInfo.phone || "-",
                    address: customerInfo.address || "-"
                },
                canvas: {
                    walls: walls
                },
                rab: {
                    materials: materialsList,
                    grandTotal: grandTotal
                },
                materialPrices: materialPrices,
                previewImage: previewImage
            };

            const projectName = `Proyek ${customerInfo.name || "Baru"} - ${new Date().toLocaleDateString('id-ID')}`;

            if (!company?.id) {
                throw new Error("You must be logged in to a company to save projects.");
            }

            const savedData = await saveProjectToDatabase(projectName, projectData, company.id, projectId);

            if (savedData && savedData.length > 0) {
                setProjectId(savedData[0].id);
            }

            alert("Project saved successfully!");
        } catch (error) {
            alert("Failed to save project: " + error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExport = () => {
        if (!wallEditorRef.current) return;
        const stage = wallEditorRef.current.getStage();
        if (!stage) return;

        const dataURL = stage.toDataURL({ pixelRatio: 2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = () => {
            const padding = 40;
            const rowHeight = 30;
            const headerHeight = 60;
            const footerHeight = headerHeight + (products.length + 2) * rowHeight + padding * 2;

            canvas.width = img.width;
            canvas.height = img.height + footerHeight;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, img.height);
            ctx.lineTo(canvas.width, img.height);
            ctx.stroke();

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('Bill of Materials', padding, img.height + padding + 20);

            ctx.font = '16px Arial';
            ctx.fillStyle = '#64748b';
            ctx.fillText(`Total Wall Area: ${Math.ceil(totals.totalArea)} m²`, padding, img.height + padding + 55);
            ctx.fillText(`Total Design Area: ${Math.ceil(totals.totalDesignArea)} m²`, padding, img.height + padding + 80);

            let currentY = img.height + padding + 120;
            products.forEach((product: Product) => {
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

            const link = document.createElement('a');
            link.download = `wall-plan-${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = dataURL;
    };

    return (
        <div className="w-full md:w-[380px] bg-[#f8fafc] h-full flex flex-col border-l border-slate-200 shadow-[0_0_40px_rgba(0,0,0,0.05)] relative z-10 overflow-hidden font-sans">
            <UserHeader user={user} company={company} onLogout={handleLogout} />

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:pb-8">
                <WallManager 
                    walls={walls} 
                    activeWallId={activeWallId} 
                    addWall={addWall} 
                    removeWall={removeWall} 
                    setActiveWall={setActiveWall} 
                    updateWallName={updateWallName} 
                />

                <CustomerInfoSection customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} />

                {/* Actions & Modes */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={reset} className="p-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-bold text-sm shadow-sm hover:bg-rose-50 transition-colors">🔄 Clear</button>
                        <button
                            onClick={() => toggleWallLock()}
                            disabled={!isClosed}
                            className={`p-3 rounded-xl font-bold text-sm shadow-sm transition-all border ${isWallLocked ? "bg-slate-700 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"} disabled:opacity-50`}
                        >
                            {isWallLocked ? "🔒 Unlock" : "🔓 Lock"}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={undo} disabled={past.length === 0} className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors">↩️ Undo</button>
                        <button onClick={redo} disabled={future.length === 0} className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors">↪️ Redo</button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Tool Mode</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => setInteractionMode('pan')} className={`p-3 rounded-xl font-bold text-sm transition-all border ${interactionMode === 'pan' ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-600"}`}>🖐️ Pan Mode</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setInteractionMode('place')} className={`p-3 rounded-xl font-bold text-sm transition-all border ${interactionMode === 'place' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>➕ Place</button>
                            <button onClick={() => setInteractionMode('delete')} className={`p-3 rounded-xl font-bold text-sm transition-all border ${interactionMode === 'delete' ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>🗑️ Delete</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Moulding Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setListDrawingType('line')} className={`p-3 rounded-xl font-bold text-sm transition-all border ${listDrawingType === 'line' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>📏 Line</button>
                            <button onClick={() => setListDrawingType('rectangle')} className={`p-3 rounded-xl font-bold text-sm transition-all border ${listDrawingType === 'rectangle' ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>⬛ Square</button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Select Product</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {isLoadingProducts ? (
                            <div className="p-4 text-center text-xs animate-pulse">🔄 Loading...</div>
                        ) : (
                            products.map((product: Product) => (
                                <button
                                    key={product.id}
                                    onClick={() => {
                                        setSelectedProduct(product.id);
                                        if (product.countType === 'length') setInteractionMode('list');
                                        else setInteractionMode('place');
                                    }}
                                    className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${selectedProductId === product.id ? "bg-indigo-600 border-indigo-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-700"}`}
                                >
                                    <span className="font-bold text-sm">{product.name}</span>
                                    <div className="w-5 h-5 rounded-md border border-white/20" style={{ background: product.color }} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Add Extras</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setInteractionMode('window')} className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'window' ? "bg-sky-600 border-sky-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>🪟 Window</button>
                        <button onClick={() => setInteractionMode('door')} className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'door' ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>🚪 Door</button>
                    </div>
                </div>

                <div className="bg-slate-100/50 p-4 rounded-xl space-y-4 border border-slate-200/50">
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Waste (%)</span>
                        <input type="number" value={wastePercentage} onChange={(e) => setWastePercentage(Number(e.target.value))} className="w-20 p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-black outline-none" />
                    </div>
                </div>

                {/* Bill of Materials View */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Bill of Materials</h3>
                        {isCalculating && <span className="text-[10px] text-indigo-500 font-bold animate-pulse italic">Calculating...</span>}
                    </div>

                    {!isClosed ? (
                        <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                            <div className="text-2xl">📐</div>
                            <p className="text-xs font-medium text-slate-400 leading-relaxed italic">Click the wall surface<br />to begin placing materials</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-3">
                                <StatCard label="Total Area" value={`${Math.ceil(totals.totalArea)} m²`} icon="📐" />
                                <StatCard label="Design Area" value={`${Math.ceil(totals.totalDesignArea)} m²`} icon="🎯" />
                            </div>

                            <div className="mt-4 bg-indigo-900 rounded-2xl p-5 border border-indigo-800 shadow-xl shadow-indigo-100">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Total Materials Needed</h5>
                                <div className="space-y-1">
                                    {products.map((product: Product) => {
                                        const count = totalProductCounts[product.id] || 0;
                                        if (count === 0) return null;
                                        const price = materialPrices[product.id] || 0;
                                        return (
                                            <div key={product.id} className="py-3 border-b border-indigo-800/50 last:border-0 group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">{product.name}</span>
                                                    <span className="text-sm font-black text-indigo-400">{count} {product.countType === 'length' ? 'btg' : 'pcs'}</span>
                                                </div>
                                                <div className="flex items-center gap-3 bg-indigo-950/50 p-2 rounded-lg border border-indigo-800/30">
                                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Unit Price</span>
                                                    <div className="flex items-center gap-1.5 flex-1 pr-2">
                                                        <span className="text-[10px] text-indigo-400">Rp</span>
                                                        <input
                                                            type="number"
                                                            value={price}
                                                            onChange={(e) => setMaterialPrice(product.id, Number(e.target.value))}
                                                            className="flex-1 bg-transparent border-none text-xs font-mono font-bold text-indigo-200 focus:outline-none p-0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Detailed Breakdown</h4>
                                {walls.map((wall, wallIdx) => {
                                    const metrics = wallMetrics[wallIdx];
                                    if (!metrics) return null;
                                    const wallHasContent = Object.values(metrics.productAreas).some((a: any) => a > 0) || Object.values(metrics.productLengths).some((l: any) => l > 0);

                                    return (
                                        <div key={wall.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-indigo-600 text-white w-5 h-5 rounded-lg flex items-center justify-center text-[9px]">{wallIdx + 1}</span>
                                                    {wall.name}
                                                </div>
                                                {!wall.isClosed && <span className="text-[9px] font-bold text-rose-500 uppercase px-2 py-1 bg-rose-50 rounded-full border border-rose-100">Draft</span>}
                                            </div>

                                            <div className="p-4">
                                                {wallHasContent ? (
                                                    <div className="space-y-4">
                                                        {products.map((product: Product) => {
                                                            const area = metrics.productAreas[product.id] || 0;
                                                            const length = metrics.productLengths[product.id] || 0;
                                                            if (area === 0 && length === 0) return null;
                                                            return (
                                                                <div key={product.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-700">{product.name}</div>
                                                                        <div className="text-[9px] text-slate-400 font-medium">{product.countType === 'length' ? `${product.unitLength}m unit` : `${((product.width || 0) * 100).toFixed(0)}cm x ${product.height}m`}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-sm font-black text-slate-700 font-mono">{(product.countType === 'length' ? length : area).toFixed(2)}</span>
                                                                        <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase">{product.countType === 'length' ? "m" : "m²"}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-400 font-medium italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No materials assigned</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4">
                    <button onClick={handleSaveProject} disabled={isSaving || !isClosed} className="w-full p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                        <span className="text-xl">💾</span>
                        <div className="text-left font-black uppercase tracking-widest text-[10px]">{isSaving ? 'Uploading...' : 'Save Database'}</div>
                    </button>
                    <button onClick={handleExport} disabled={!isClosed} className="w-full p-4 bg-white border border-slate-200 rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                        <span className="text-xl">🖼️</span>
                        <div className="text-left font-black uppercase tracking-widest text-[10px]">Export Plan</div>
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                if (!company?.logo_url) { alert("Upload logo first!"); return; }
                                if (!customerInfo.name || !customerInfo.phone) { alert("Fill customer info!"); return; }
                                await generateRAB(walls, customerInfo, wastePercentage, wallMetrics, totalProductCounts, materialPrices, products, company?.logo_url);
                            } catch (e) { alert("PDF Error: " + e); }
                        }}
                        disabled={!isClosed}
                        className="w-full p-4 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        <span className="text-xl text-indigo-400">📑</span>
                        <div className="text-left font-black uppercase tracking-widest text-[10px]">Generate PDF</div>
                    </button>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
    return (
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <span className="text-xl">{icon}</span>
            <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
                <div className="text-lg font-extrabold text-slate-800 leading-tight">{value}</div>
            </div>
        </div>
    );
}
