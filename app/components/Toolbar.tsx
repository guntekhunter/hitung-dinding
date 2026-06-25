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
import { ChevronDown, Folder, Lock, Move, Save, Settings, Trash2, Unlock, RotateCcw, Plus, Minus, PenLine, Square, DoorClosed, Grid2x2, Ruler, Scan, FileText, Grid, Undo, Copy } from 'lucide-react';

// --- Split into smaller memoized components to prevent global re-renders ---

const UserHeader = memo(({ user, company, onLogout, onSaveClick, isSaving, isClosed, toggleWallLock, isWallLocked, interactionMode, setInteractionMode, reset, undo, past = [], isMobile }: any) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <div className="bg-white border-b border-slate-100 flex flex-col shrink-0 border-b border-slate-100">
            <div className="p-4 flex justify-between items-center border-b border-slate-50 relative">
                {/* User Dropdown Trigger */}
                {/* User Dropdown Trigger */}
                {user ? (
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                    >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black bg-[#7B6DED]">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="flex items-center justify-center h-10 px-4 rounded-xl text-white font-bold text-xs bg-[#7B6DED] hover:bg-[#6859dd] transition-all hover:scale-[1.02] duration-200 shadow-sm"
                    >
                        Login / Masuk
                    </Link>
                )}

                {/* Dropdown Modal */}
                {isProfileOpen && user && (
                    <div className="absolute top-[70px] left-4 bg-[#232323] p-4 rounded-xl w-[260px] shadow-2xl z-50 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex shrink-0 items-center justify-center text-white font-black bg-[#7B6DED] text-xl">
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="flex flex-col truncate">
                                <span className="text-white font-medium text-sm truncate">{user?.name || "User"}</span>
                                <span className="text-gray-400 text-xs truncate">{company?.name || "Company"}</span>
                            </div>
                        </div>
                        <button
                            onClick={onLogout}
                            className="w-full bg-[#EA726B] hover:bg-[#D9615A] text-white py-2 rounded-lg font-medium transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                )}

                {/* Overlay to close modal when clicking outside */}
                {isProfileOpen && (
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsProfileOpen(false)}
                    />
                )}

                {user && (
                    <div className="flex gap-2 text-[.8rem]">
                        <button
                            onClick={onSaveClick}
                            disabled={isSaving || !isClosed}
                            className="flex bg-[#F5F5F5] py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-[1rem]" />
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>

                        <Link href="/projects" className="flex bg-[#F5F5F5] py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300"><Folder className="w-[1rem]" />
                            Proyek</Link>
                        <Link href="/settings" className="flex bg-[#F5F5F5] py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300">
                            <Settings className="w-[1rem]" />
                        </Link>
                    </div>
                )}
            </div>
            <div className="p-4 flex items-center justify-between">
                <div className="flex space-x-[0.5rem] md:space-x-[0.75rem]">
                    <button
                        onClick={isMobile ? undo : reset}
                        disabled={isMobile && past.length === 0}
                        className={`flex py-2 px-3 rounded-[5px] items-center gap-2 duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'bg-[#F5F5F5] hover:bg-[#E2E2E2] text-slate-700' : 'bg-[#F5F5F5] hover:bg-rose-100 text-rose-600'}`}
                        title={isMobile ? "Undo" : "Clear All"}
                    >
                        {isMobile ? <Undo className="w-[1rem]" /> : <RotateCcw className="w-[1rem]" />}
                    </button>
                    {!isMobile && (
                        <button
                            onClick={undo}
                            disabled={past.length === 0}
                            className="flex py-2 px-3 rounded-[5px] items-center gap-2 duration-300 bg-[#F5F5F5] hover:bg-[#E2E2E2] text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo"
                        >
                            <Undo className="w-[1rem]" />
                        </button>
                    )}
                    <button
                        onClick={() => toggleWallLock()}
                        disabled={!isClosed}
                        className={`flex py-2 px-3 rounded-[5px] items-center gap-2 duration-300 disabled:opacity-50 ${isWallLocked ? 'bg-slate-700 text-white' : 'bg-[#F5F5F5] hover:bg-[#E2E2E2]'}`}
                        title={isWallLocked ? "Unlock" : "Lock"}
                    >
                        {isWallLocked ? <Lock className="w-[1rem]" /> : <Unlock className="w-[1rem]" />}
                    </button>
                    <button
                        onClick={() => setInteractionMode('pan')}
                        className={`flex py-2 px-3 rounded-[5px] items-center gap-2 duration-300 ${interactionMode === 'pan' ? 'bg-slate-800 text-white' : 'bg-[#F5F5F5] hover:bg-[#E2E2E2]'}`}
                        title="Pan Mode"
                    >
                        <Move className="w-[1rem]" />
                    </button>
                    <button
                        onClick={() => setInteractionMode('delete')}
                        className={`flex py-2 px-3 rounded-[5px] items-center gap-2 duration-300 ${interactionMode === 'delete' ? 'bg-rose-600 text-white' : 'bg-[#F5F5F5] hover:bg-[#E2E2E2]'}`}
                        title="Delete"
                    >
                        <Trash2 className="w-[1rem]" />
                    </button>
                </div>
            </div>
        </div>
    );
});

const WallManager = memo(({ walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName, duplicateWall }: any) => (
    <div className="space-y-[1rem]">
        <div className="flex justify-between items-center space-x-[2rem]">
            <h3 className="font-medium uppercase text-[10px] tracking-widest">Dinding</h3>
            <button
                onClick={addWall}
                className="px-2 py-1 rounded-md font-bold hover:bg-gray-200"
            >
                <Plus className="w-[1rem]" />
            </button>
        </div>
        <div className="space-y-2">
            {walls.map((wall: any) => (
                <div
                    key={wall.id}
                    onClick={() => setActiveWall(wall.id)}
                    className={`flex items-center gap-2 p-2 text-[.5rem] text-[#303030] font-light rounded-[5px] cursor-pointer transition-all border ${activeWallId === wall.id
                        ? "bg-white border-[#E5E5E5]"
                        : "bg-transparent border-[#E5E5E5] hover:bg-slate-50"
                        }`}
                >
                    <input
                        value={wall.name}
                        onChange={(e) => updateWallName(wall.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent border-none text-[.8rem] focus:outline-none"
                    />
                    <button
                        onClick={(e) => { e.stopPropagation(); duplicateWall(wall.id); }}
                        className="p-1 text-slate-300 hover:text-indigo-500 transition-colors"
                        title="Duplicate wall"
                    >
                        <Copy className="w-[1rem]" />
                    </button>
                    {walls.length > 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); removeWall(wall.id); }}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                            <Minus className="w-[1rem]" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
));

const SaveProjectModal = memo(({ isOpen, onClose, customerInfo, setCustomerInfo, onSave, isSaving }: any) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
            <div
                className="relative bg-white py-2 px-3 rounded-[5px] shadow-2xl w-full max-w-md border border-slate-200 animate-[slideUp_0.3s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h3 className="font-bold uppercase text-[14px]">Simpan Proyek</h3>
                        <p className="font-light text-[10px] mt-0.5">Silahkan Masukan Detail Proyek</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <div>
                        <label className="block text-[10px] font-medium mb-1.5">Customer Name</label>
                        <input
                            placeholder="Enter customer name"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            className="w-full p-3 border border-[#F5F5F5] rounded-xl text-[10px] focus:ring-[.01rem] focus:ring-[#E2E2E2] focus:border-[#E2E2E2] outline-none transition-all"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium mb-1.5">Surveyor Name</label>
                        <input
                            placeholder="Enter surveyor name"
                            value={customerInfo.surveyorName}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, surveyorName: e.target.value })}
                            className="w-full p-3 border border-[#F5F5F5] rounded-xl text-[10px] focus:ring-[.01rem] focus:ring-[#E2E2E2] focus:border-[#E2E2E2] outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="text-[12px] flex-1 py-2 px-3 rounded-[5px] items-center duration-300 bg-[#F5F5F5] hover:bg-[#E2E2E2] text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onSave(); onClose(); }}
                        disabled={isSaving}
                        className="text-[12px] text-white w-[50%] gap-2 flex py-2 px-3 justify-center rounded-[5px] items-center duration-300 hover:bg-[#F5F5F5] hover:text-[#7B6DED] text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed bg-[#7B6DED]"
                    >
                        <span className="flex items-center gap-2">
                            <Save className="w-[1rem]" /> {isSaving ? 'Menyimpan...' : 'Simpan Proyek'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
});

const CustomerInfoModal = memo(({ isOpen, onClose, customerInfo, setCustomerInfo, onGenerate }: any) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" />
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 animate-[slideUp_0.3s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight">Customer Details</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Fill in customer info before generating PDF</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Phone Number</label>
                        <input
                            placeholder="Enter phone number"
                            value={customerInfo.phone}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Address</label>
                        <textarea
                            placeholder="Enter address"
                            value={customerInfo.address}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { onGenerate(); onClose(); }}
                        className="flex-1 p-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        <span>📑</span> Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function Toolbar({ wallEditorRef }: { wallEditorRef: any }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [calcResults, setCalcResults] = useState<any>(null);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const router = useRouter();
    const { user, company, clearSession } = useAuthStore();

    const {
        walls, activeWallId, addWall, removeWall, setActiveWall, updateWallName, duplicateWall,
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
    const wallMetrics = (calcResults?.wallMetrics || []) as any[];
    const totalProductCounts = (calcResults?.totalProductCounts || {}) as Record<string, number>;

    const totals = useMemo(() => {
        if (!calcResults) return { totalArea: 0, totalDesignArea: 0, grandTotalPrice: 0 };

        const grandTotal = products.reduce((sum, product) => {
            const count = totalProductCounts[product.id] || 0;
            const price = materialPrices[product.id] ?? product.price ?? 0;
            return sum + (count * price);
        }, 0);

        const totalDesignArea = wallMetrics.reduce((sum: number, m: any) => {
            const areas = Object.values(m.productAreas || {}) as number[];
            return sum + areas.reduce((a: number, b: number) => a + b, 0);
        }, 0);

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
            totalDesignArea: totalDesignArea,
            grandTotalPrice: grandTotal
        };
    }, [calcResults, walls, wallMetrics, products, totalProductCounts, materialPrices]);

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
                mimeType: 'image/png',
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
        <div className="w-full md:w-[300px] lg:w-[380px] bg-white h-full flex flex-col border-l border-slate-200 relative z-10 overflow-hidden font-sans">
            <UserHeader
                user={user}
                company={company}
                onLogout={handleLogout}
                onSaveClick={() => setShowSaveModal(true)}
                isSaving={isSaving}
                isClosed={isClosed}
                toggleWallLock={toggleWallLock}
                isWallLocked={isWallLocked}
                interactionMode={interactionMode}
                setInteractionMode={setInteractionMode}
                reset={reset}
                undo={undo}
                past={past}
                isMobile={isMobile}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24 md:pb-8">
                <WallManager
                    walls={walls}
                    activeWallId={activeWallId}
                    addWall={addWall}
                    removeWall={removeWall}
                    setActiveWall={setActiveWall}
                    updateWallName={updateWallName}
                    duplicateWall={duplicateWall}
                />
                <hr className="border-[#E8E8E8]" />
                {/* Actions & Modes */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-medium uppercase text-[10px] tracking-widest">Moulding Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setListDrawingType('line')} className={`flex py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 border-[#E5E5E5] border ${listDrawingType === 'line' ? "bg-[#E2E2E2] text-[#303030] rounded-[2px] flex text-[.8rem]" : "flex border-[#E5E5E5] py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 text-[.8rem]"}`}><PenLine className="w-[1rem]" /> Lurus</button>
                            <button onClick={() => setListDrawingType('rectangle')} className={`flex py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 border-[#E5E5E5] border ${listDrawingType === 'line' ? "text-[#303030] rounded-[2px] flex text-[.8rem]" : "bg-[#E2E2E2] flex border-[#E5E5E5] py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 text-[.8rem]"}`}><Square className="w-[1rem]" /> Kotak</button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <hr className="border-[#E8E8E8]" />
                    <h3 className="font-medium uppercase text-[10px] tracking-widest">Pilih Produk</h3>
                    <div className="grid grid-cols-2 gap-2">
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
                                    className={`flex py-2 px-3 rounded-[5px] items-center gap-2 hover:bg-[#E2E2E2] duration-300 border-[#E5E5E5] border flex items-center justify-between transition-all ${selectedProductId === product.id ? "bg-[#F5F5F5] border-[#F5F5F5] text-[#303030]" : "bg-white border-slate-200"}`}
                                >
                                    <span className="font-bold text-[10px] font-medium">{product.name}</span>
                                    <div className="w-5 h-5 rounded-md border border-white/20" style={{ background: product.color }} />
                                </button>
                            ))
                        )}
                    </div>
                </div>
                <hr className="border-[#E8E8E8]" />

                <div className="space-y-2">
                    <h3 className="font-medium uppercase text-[10px] tracking-widest">Tambahan</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setInteractionMode('window')} className={`flex items-center gap-2 p-2 rounded-[5px] font-medium text-[.8rem] transition-all border ${interactionMode === 'window' ? "bg-[#E5E5E5] border-[#E5E5E5] text-[#303030] rounded-[2px] flex text-[.8rem] gap-2" : "bg-white border-[#E5E5E5] text-slate-600 flex text-[.8rem] gap-2"}`}><Grid2x2 className="w-[1rem]" /> Jendela</button>
                        <button onClick={() => setInteractionMode('door')} className={`flex items-center gap-2 p-2 rounded-[5px] font-medium text-[.8rem] transition-all border ${interactionMode === 'door' ? "bg-[#E5E5E5] border-[#E5E5E5] text-[#303030] rounded-[2px] flex text-[.8rem] gap-2" : "bg-white border-[#E5E5E5] text-slate-600 flex text-[.8rem] gap-2"}`}><DoorClosed className="w-[1rem]" /> Pintu</button>
                    </div>
                </div>

                <hr className="border-[#E8E8E8]" />
                <div className="flex justify-between items-center gap-4">
                    <h3 className="font-medium uppercase text-[10px] tracking-widest">Sisaan Bahan (%)</h3>
                    <input type="number" value={wastePercentage} onChange={(e) => setWastePercentage(Number(e.target.value))} className="w-20 p-2 bg-white border border-slate-200 rounded-lg text-center text-sm font-medium outline-none text-[.8rem]" />
                </div>


                {/* Bill of Materials View */}
                <div className="space-y-4">
                    <hr className="border-[#E8E8E8]" />
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium uppercase text-[10px] tracking-widest">Hitungan Area</h3>
                        {isCalculating && <span className="text-[10px] text-indigo-500 font-bold animate-pulse italic">Calculating...</span>}
                    </div>

                    {!isClosed ? (
                        <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                            <div className="text-2xl">📐</div>
                            <p className="text-xs font-medium text-slate-400 leading-relaxed italic">Click the wall surface<br />to begin placing materials</p>
                        </div>
                    ) : (
                        <div className="space-y-6 relative">
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    label="Total Area"
                                    value={`${Math.ceil(totals.totalArea)} m²`}
                                >
                                    <Ruler className="w-[1rem]" />
                                </StatCard>

                                <StatCard
                                    label="Design Area"
                                    value={`${Math.ceil(totals.totalDesignArea)} m²`}
                                >
                                    <Scan className="w-[1rem]" />
                                </StatCard>
                            </div>

                            <hr className="border-[#E8E8E8]" />

                            <div className={`space-y-6 transition-all ${!user ? "filter blur-md select-none pointer-events-none opacity-40" : ""}`}>
                                <h3 className="font-medium uppercase text-[10px] tracking-widest">Total Kebutuhan</h3>
                                <div className="grid grid-cols-1 gap-x-4 gap-y-4">
                                    {products.map((product: Product) => {
                                        const count = totalProductCounts[product.id] || 0;
                                        if (count === 0) return null;
                                        const price = materialPrices[product.id] || 0;
                                        return (
                                            <div key={product.id} className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-4 text-[.8rem] text-[#303030]">
                                                    <span>{product.name}</span>
                                                    <span className="font-bold">{count} {product.countType === 'length' ? 'Btg' : 'Pcs'}</span>
                                                </div>
                                                <div className="flex items-center justify-between border border-[#E5E5E5] rounded-[5px] p-2 bg-white">
                                                    <span className="text-[.8rem] text-[#303030]">Harga Produk</span>
                                                    <div className="flex items-center gap-1 text-[.8rem] text-[#303030]">
                                                        <span>Rp</span>
                                                        <input
                                                            type="number"
                                                            value={price === 0 ? '' : price}
                                                            onChange={(e) => setMaterialPrice(product.id, Number(e.target.value))}
                                                            className="w-24 bg-transparent outline-none font-medium p-0"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end items-center gap-2 text-[.8rem] text-[#303030]">
                                                    <span>Subtotal</span>
                                                    <span className="font-bold">Rp {(count * price).toLocaleString('id-ID')}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {totals.grandTotalPrice > 0 && (
                                    <div className="mt-4 flex items-center justify-between gap-4">
                                        <div className="flex flex-col w-[120px]">
                                            <span className="text-[.8rem] font-bold text-[#303030]">Total Harga</span>
                                            <span className="text-[.8rem] text-[#707070]">Sisa Bahan {wastePercentage}%</span>
                                        </div>
                                        <div className="flex-1 flex items-center border border-[#E5E5E5] rounded-[5px] p-2 bg-white">
                                            <span className="text-[.8rem] font-bold text-[#303030]">Rp {totals.grandTotalPrice.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                )}
                                <hr className="border-[#E8E8E8]" />

                                <div className="space-y-4">
                                    <h3 className="font-medium uppercase text-[10px] tracking-widest">Detail Kebutuhan</h3>
                                    {walls.map((wall, wallIdx) => {
                                        const metrics = wallMetrics[wallIdx];
                                        if (!metrics) return null;
                                        const wallHasContent = Object.values(metrics.productAreas).some((a: any) => a > 0) || Object.values(metrics.productLengths).some((l: any) => l > 0);

                                        return (
                                            <div key={wall.id} className="bg-white rounded-xl border border-[#E5E5E5] flex">
                                                <div className="w-16 flex justify-center pt-4">
                                                    <span className="text-4xl font-bold text-[#303030]">{wallIdx + 1}</span>
                                                </div>
                                                <div className="flex-1 pr-4">
                                                    {wallHasContent ? (
                                                        <div className="flex flex-col">
                                                            {products.map((product: Product) => {
                                                                const area = metrics.productAreas[product.id] || 0;
                                                                const length = metrics.productLengths[product.id] || 0;
                                                                if (area === 0 && length === 0) return null;

                                                                const val = product.countType === 'length' ? length : area;
                                                                const unit = product.countType === 'length' ? 'm' : 'm²';
                                                                const formattedVal = val.toFixed(2).replace(/\.00$/, ''); // Matches whole numbers like in the mockup

                                                                return (
                                                                    <div key={product.id} className="flex justify-between items-center py-4 border-b border-[#E5E5E5] last:border-0">
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[#A3A3A3] text-[.8rem]">{product.name}</span>
                                                                            <span className="text-[#303030] text-[.8rem] font-bold">{formattedVal} {unit}</span>
                                                                        </div>
                                                                        <div className="text-[#303030] text-[.8rem] font-bold">
                                                                            {formattedVal} {unit}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="py-4 text-[.8rem] text-[#A3A3A3]">Tidak ada material</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Center-aligned overlay for non-logged in users */}
                            {!user && (
                                <div className="absolute top-[80px] left-0 right-0 bottom-0 flex flex-col items-center justify-start pt-16 px-4 bg-white/40 backdrop-blur-[1px] rounded-xl z-20 pointer-events-auto">
                                    <div className="bg-white/95 p-6 rounded-xl border border-slate-200 shadow-xl flex flex-col items-center gap-4 text-center max-w-[280px] w-full">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl font-bold shadow-inner animate-pulse">
                                            🔒
                                        </div>
                                        <p className="text-xs font-bold text-slate-700 leading-relaxed">
                                            Silakan login terlebih dahulu untuk melihat hasil perhitungan kebutuhan material dan harga secara detail.
                                        </p>
                                        <Link
                                            href="/login"
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition-all text-center shadow-md shadow-indigo-200 active:scale-95"
                                        >
                                            Login Sekarang
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    <hr className="border-[#E8E8E8] mb-4" />
                    <h3 className="font-medium uppercase text-[10px] tracking-widest mb-3">Export</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                if (!company?.logo_url) { alert("Upload logo first!"); return; }
                                setShowPdfModal(true);
                            }}
                            disabled={!isClosed || !user}
                            className="flex items-center gap-3 p-3 bg-white border border-[#E5E5E5] rounded-md active:scale-95 disabled:opacity-50 transition-transform hover:bg-gray-50"
                        >
                            <FileText className="w-4 h-4 text-[#303030]" />
                            <span className="text-[.8rem] text-[#303030]">RAB</span>
                        </button>

                        <button
                            onClick={handleExport}
                            disabled={!isClosed || !user}
                            className="flex items-center gap-3 p-3 bg-white border border-[#E5E5E5] rounded-md active:scale-95 disabled:opacity-50 transition-transform hover:bg-gray-50"
                        >
                            <Grid className="w-4 h-4 text-[#303030]" />
                            <span className="text-[.8rem] text-[#303030]">Desain</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Save Project Modal */}
            <SaveProjectModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                onSave={handleSaveProject}
                isSaving={isSaving}
            />

            {/* Customer Info Modal for PDF Generation */}
            <CustomerInfoModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                onGenerate={async () => {
                    try {
                        const wallImages: string[] = [];
                        const stage = wallEditorRef.current?.getStage();

                        if (stage && walls.length > 0) {
                            const store = useCanvasStore.getState();
                            const originalActiveId = activeWallId;

                            for (const wall of walls) {
                                store.setActiveWall(wall.id);
                                // Wait for React to re-render the new wall + Konva to repaint
                                await new Promise(r => setTimeout(r, 500));
                                stage.draw();
                                await new Promise(r => setTimeout(r, 200));
                                try {
                                    wallImages.push(stage.toDataURL({ pixelRatio: 1.5, mimeType: 'image/png' }));
                                } catch { wallImages.push(''); }
                            }

                            // Restore original active wall
                            store.setActiveWall(originalActiveId ?? walls[0]?.id ?? '');
                            await new Promise(r => setTimeout(r, 100));
                        }

                        await generateRAB(walls, customerInfo, wastePercentage, wallMetrics, totalProductCounts, materialPrices, products, company?.logo_url, wallImages);
                    } catch (e) { alert("PDF Error: " + e); }
                }}
            />
        </div >
    );
}

function StatCard({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
    return (
        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
            <span className="text-xl flex items-center justify-center">{children}</span>
            <div>
                <div className="text-[.8rem] text-[#B0B0B0]">{label}</div>
                <div className="text-[.8rem] text-[#303030] font-bold">{value}</div>
            </div>
        </div>
    );
}
