"use client";

import { useState } from "react";
import { useCanvasStore, PRODUCTS, SCALE, Wall } from "../store/useCanvasStore";
import { countPanels, countBoards } from "../function/materialEngine";
import { subtractRect, Rect } from "../function/geometry";
import { generateRAB } from "../utils/rabGenerator";
import { saveProjectToDatabase, ProjectData } from "../utils/saveProject";
import Link from "next/link";
import { useAuthStore } from "../store/useAuthStore";
import { logoutUser } from "../utils/auth";
import { useRouter } from "next/navigation";

export default function Toolbar({ wallEditorRef }: { wallEditorRef: any }) {
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const { user, company, clearSession } = useAuthStore();
    const {
        walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName,
        getDimensions, reset,
        selectedProductId, setSelectedProduct,
        interactionMode, setInteractionMode,
        undo, redo, past, future,
        wastePercentage, setWastePercentage,
        listDrawingType, setListDrawingType,
        customerInfo, setCustomerInfo,
        materialPrices, setMaterialPrice,
        projectId, setProjectId
    } = useCanvasStore();

    const handleLogout = async () => {
        try {
            await logoutUser();
            clearSession();
            router.push("/login");
        } catch (err) {
            console.error("Logout failed:", err);
            alert("Logout failed. Please try again.");
        }
    };

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

    const handleSaveProject = async () => {
        setIsSaving(true);
        try {
            const materialsList: ProjectData["rab"]["materials"] = [];
            let grandTotal = 0;

            PRODUCTS.forEach(product => {
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
            const previewImage = stage ? stage.toDataURL({ pixelRatio: 0.5 }) : undefined;

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
                previewImage: previewImage
            };

            const projectName = `Proyek ${customerInfo.name || "Baru"} - ${new Date().toLocaleDateString('id-ID')}`;

            if (!company?.id) {
                throw new Error("You must be logged in to a company to save projects.");
            }

            const savedData = await saveProjectToDatabase(projectName, projectData, company.id, projectId);

            // Update local state so subsequent saves overwrite
            if (savedData && savedData.length > 0) {
                setProjectId(savedData[0].id);
            }

            alert("Project saved successfully to the database!");

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
        <div className="w-full md:w-[380px] bg-[#f8fafc] h-full flex flex-col border-l border-slate-200 shadow-[0_0_40px_rgba(0,0,0,0.05)] relative z-10 overflow-hidden font-sans">
            {/* User Profile & Brand Header */}
            <div className="bg-white border-b border-slate-100 flex flex-col shrink-0">
                <div className="p-4 flex justify-between items-center border-b border-slate-50">
                    <h1 className="text-xl font-black text-slate-800 tracking-tight">Wall Planner</h1>
                    <Link href="/projects" className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">Projects 📂</Link>
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
                        onClick={handleLogout}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95 group border border-transparent hover:border-rose-100"
                        title="Logout"
                    >
                        <span className="text-xl group-hover:rotate-12 transition-transform block">🚪</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:pb-8">
                {/* Wall Manager */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest">Walls</h3>
                        <button
                            onClick={addWall}
                            className="px-2 py-1 bg-indigo-600 text-white rounded-md text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            + New Wall
                        </button>
                    </div>
                    <div className="space-y-2">
                        {walls.map(wall => (
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

                {/* Customer Information */}
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

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={reset}
                        className="p-3 bg-white text-rose-600 border border-rose-100 rounded-xl font-bold text-sm shadow-sm hover:bg-rose-50 transition-colors"
                    >
                        🔄 Clear
                    </button>
                    <button
                        onClick={() => useCanvasStore.getState().toggleWallLock()}
                        disabled={!isClosed}
                        className={`p-3 rounded-xl font-bold text-sm shadow-sm transition-all border ${isWallLocked
                            ? "bg-slate-700 border-slate-700 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isWallLocked ? "🔒 Unlock" : "🔓 Lock"}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={undo}
                        disabled={past.length === 0}
                        className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                        ↩️ Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={future.length === 0}
                        className="p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 text-sm shadow-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                        ↪️ Redo
                    </button>
                </div>

                {/* Modes */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Tool Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setInteractionMode('place')}
                                className={`p-3 rounded-xl font-bold text-sm transition-all border ${interactionMode === 'place'
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                ➕ Place
                            </button>
                            <button
                                onClick={() => setInteractionMode('delete')}
                                className={`p-3 rounded-xl font-bold text-sm transition-all border ${interactionMode === 'delete'
                                    ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Moulding Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setListDrawingType('line')}
                                className={`p-3 rounded-xl font-bold text-sm transition-all border ${listDrawingType === 'line'
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                📏 Line
                            </button>
                            <button
                                onClick={() => setListDrawingType('rectangle')}
                                className={`p-3 rounded-xl font-bold text-sm transition-all border ${listDrawingType === 'rectangle'
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                ⬛ Square
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product Selection */}
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Select Product</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {PRODUCTS.map(product => (
                            <button
                                key={product.id}
                                onClick={() => {
                                    setSelectedProduct(product.id);
                                    if (product.countType === 'length') setInteractionMode('list');
                                    else setInteractionMode('place');
                                }}
                                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${selectedProductId === product.id
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200 ring-2 ring-indigo-100"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
                                    }`}
                            >
                                <span className="font-bold text-sm">{product.name}</span>
                                <div
                                    className="w-5 h-5 rounded-md border border-white/20 shadow-inner"
                                    style={{ background: product.color }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Extras */}
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-500 uppercase text-[10px] tracking-widest px-1">Add Extras</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setInteractionMode('window')}
                            className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'window'
                                ? "bg-sky-600 border-sky-600 text-white shadow-md shadow-sky-200"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            🪟 Window
                        </button>
                        <button
                            onClick={() => setInteractionMode('door')}
                            className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'door'
                                ? "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-200"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            🚪 Door
                        </button>
                        <button
                            onClick={() => { setSelectedProduct('list'); setInteractionMode('list'); }}
                            className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'list' && selectedProductId === 'list'
                                ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            📏 List
                        </button>
                        <button
                            onClick={() => { setSelectedProduct('moulding'); setInteractionMode('list'); }}
                            className={`p-3 rounded-xl font-bold text-xs transition-all border ${interactionMode === 'list' && selectedProductId === 'moulding'
                                ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            🪄 Moulding
                        </button>
                    </div>
                </div>

                {/* Settings */}
                <div className="bg-slate-100/50 p-4 rounded-xl space-y-4 border border-slate-200/50">
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Waste (%)</span>
                        <input
                            type="number"
                            value={wastePercentage}
                            onChange={(e) => setWastePercentage(Number(e.target.value))}
                            className="w-20 p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gap (cm)</span>
                        <input
                            type="number"
                            value={useCanvasStore.getState().mouldingGap * 100}
                            onChange={(e) => useCanvasStore.getState().setMouldingGap(Number(e.target.value) / 100)}
                            className="w-20 p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                {isClosed && (
                    <button
                        onClick={() => useCanvasStore.getState().clearDesignAreas()}
                        className="w-full p-3 bg-white text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-50 transition-colors"
                    >
                        🗑️ Reset All Materials
                    </button>
                )}

                <hr className="border-slate-200" />

                {/* Bill of Materials */}
                <div className="space-y-4">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Bill of Materials</h3>

                    {!isClosed ? (
                        <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                            <div className="text-2xl">📐</div>
                            <p className="text-xs font-medium text-slate-400 leading-relaxed italic">Click the wall surface<br />to begin placing materials</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Overall Totals */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Overall Summary</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <StatCard label="Total Area" value={`${Math.ceil(totalArea)} m²`} icon="📐" />
                                    <StatCard label="Design Area" value={`${Math.ceil(totalDesignArea)} m²`} icon="🎯" />
                                </div>

                                <div className="mt-4 bg-indigo-900 rounded-2xl p-5 border border-indigo-800 shadow-xl shadow-indigo-100">
                                    <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Total Materials Needed</h5>
                                    <div className="space-y-1">
                                        {PRODUCTS.map(product => {
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
                                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter">Unit Price</span>
                                                        <div className="flex items-center gap-1.5 flex-1">
                                                            <span className="text-[10px] text-indigo-400">Rp</span>
                                                            <input
                                                                type="number"
                                                                value={price}
                                                                onChange={(e) => setMaterialPrice(product.id, Number(e.target.value))}
                                                                placeholder="0"
                                                                className="flex-1 bg-transparent border-none text-xs font-mono font-bold text-indigo-200 focus:outline-none p-0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Per-Wall Breakdown */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Detailed Breakdown</h4>
                                {walls.map((wall, wallIdx) => {
                                    const calc = wallCalculations[wallIdx];
                                    const wallHasContent = Object.values(calc.counts).some(c => c > 0);

                                    return (
                                        <div key={wall.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                                                <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-3">
                                                    <span className="bg-indigo-600 text-white w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black">{wallIdx + 1}</span>
                                                    {wall.name}
                                                </h4>
                                                {!wall.isClosed && <span className="text-[9px] font-bold text-rose-500 uppercase px-2 py-1 bg-rose-50 rounded-full border border-rose-100">Draft</span>}
                                            </div>

                                            <div className="p-4">
                                                {!wall.isClosed ? (
                                                    <div className="text-[11px] text-slate-400 font-medium italic text-center py-4 px-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">Wall perimeter is not closed yet</div>
                                                ) : !wallHasContent ? (
                                                    <div className="text-[11px] text-slate-400 font-medium italic text-center py-4 px-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">No materials assigned to this wall</div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {PRODUCTS.map(product => {
                                                            const count = calc.counts[product.id] || 0;
                                                            if (count === 0) return null;
                                                            const mBreakdown = calc.mouldingBreakdown[product.id];
                                                            const aBreakdown = calc.areaBreakdown[product.id];
                                                            const totalValue = product.countType === 'length' ? (calc.productLengths[product.id] || 0) : (calc.productAreas[product.id] || 0);
                                                            const unit = product.countType === 'length' ? "btg" : "pcs";

                                                            return (
                                                                <div key={product.id} className="space-y-2">
                                                                    <MaterialItem
                                                                        label={product.name}
                                                                        sub={product.countType === 'length' ? `${product.unitLength}m length` : `${(product.width * 100).toFixed(0)}cm x ${product.height}m`}
                                                                        count={count}
                                                                        unit={unit}
                                                                    />
                                                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1.5 shadow-inner">
                                                                        {product.countType === 'length' ? (
                                                                            <>
                                                                                <div className="text-[10px] text-slate-500 flex justify-between"><span>Total Length:</span> <span className="font-bold text-slate-800">{totalValue.toFixed(2)}m</span></div>
                                                                                {mBreakdown && <div className="text-[10px] text-slate-500 flex justify-between"><span>Per Segment:</span> <span className="font-bold text-indigo-600 tracking-tighter">{mBreakdown.segmentLengths.map(l => Math.ceil(l / (product.unitLength || 2.9))).join(', ')}</span></div>}
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="text-[10px] text-slate-500 flex justify-between"><span>Total Area:</span> <span className="font-bold text-slate-800">{totalValue.toFixed(2)}m²</span></div>
                                                                                {aBreakdown && <div className="text-[10px] text-slate-500 flex justify-between"><span>Per Area:</span> <span className="font-bold text-indigo-600 tracking-tighter">{aBreakdown.areas.map(a => a.sticks).join(', ')}</span></div>}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="grid grid-cols-1 gap-3 pt-4">
                    <button
                        onClick={handleSaveProject}
                        disabled={isSaving || !isClosed}
                        className="w-full p-4 bg-emerald-600 border-none rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <span className="text-xl">💾</span>
                        <div className="text-left">
                            <div className="text-xs font-black text-white uppercase tracking-widest">{isSaving ? 'Saving...' : 'Save Database'}</div>
                            <div className="text-[9px] font-bold text-emerald-200">Save project to cloud</div>
                        </div>
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={!isClosed}
                        className="w-full p-4 bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <span className="text-xl">🖼️</span>
                        <div className="text-left">
                            <div className="text-xs font-black text-slate-800 uppercase tracking-widest">Export Plan</div>
                            <div className="text-[9px] font-bold text-slate-400">Download high-res PNG image</div>
                        </div>
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await generateRAB(walls, customerInfo, wastePercentage, calculateWallMaterials, materialPrices);
                            } catch (e) {
                                alert("Failed to generate PDF: " + e);
                            }
                        }}
                        disabled={!isClosed}
                        className="w-full p-4 bg-slate-900 border-none rounded-2xl shadow-lg shadow-slate-900/20 flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <span className="text-xl text-indigo-400">📑</span>
                        <div className="text-left">
                            <div className="text-xs font-black text-white uppercase tracking-widest">Generate PDF</div>
                            <div className="text-[9px] font-bold text-slate-500">Professional Bill of Materials</div>
                        </div>
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

function MaterialItem({ label, sub, count, unit }: { label: string; sub: string; count: number; unit: string }) {
    return (
        <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
            <div>
                <div className="text-sm font-bold text-slate-700">{label}</div>
                <div className="text-[10px] text-slate-400 font-medium">{sub}</div>
            </div>
            <div className="text-right">
                <span className="text-base font-black text-indigo-600 font-mono">{count}</span>
                <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase">{unit}</span>
            </div>
        </div>
    );
}
