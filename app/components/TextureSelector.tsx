"use client";

import React, { useMemo } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";
import { Plus, Copy, Minus } from 'lucide-react';

const MockupManager = ({ mockups, activeMockupId, addMockup, removeMockup, setActiveMockup, updateMockupName, duplicateMockup }: any) => (
    <div className="w-full flex-shrink-0 bg-white border-b border-gray-200 flex flex-col p-4">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold uppercase text-[12px] text-gray-700 tracking-wider">Mockups</h3>
            <button onClick={addMockup} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition">
                <Plus size={16} />
            </button>
        </div>
        <div className="flex flex-col gap-2">
            {mockups?.map((m: any) => (
                <div key={m.id} onClick={() => setActiveMockup(m.id)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${activeMockupId === m.id ? 'bg-[#F5F3FF] border-[#7B6DED] ' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    <input
                        value={m.name}
                        onChange={(e) => updateMockupName(m.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent border-none text-sm focus:outline-none text-gray-800 font-medium"
                    />
                    <button onClick={(e) => { e.stopPropagation(); duplicateMockup(m.id); }} className="p-1 text-gray-400 hover:text-[#7B6DED] transition">
                        <Copy size={14} />
                    </button>
                    {mockups.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeMockup(m.id); }} className="p-1 text-gray-400 hover:text-red-500 transition">
                            <Minus size={14} />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
);

export default function TextureSelector({
    mockupsList,
    activeMockupId,
    handleAddMockup,
    handleRemoveMockup,
    handleSetActiveMockup,
    handleUpdateMockupName,
    handleDuplicateMockup
}: any = {}) {
    const {
        walls, products,
        setProductColor,
        setDesignAreaColor,
        setWallProductColor,
        setSelectedDesignAreaId,
        setSelectedWallId,
        activeWallId,
        setCeilingBaseColor,
        setCeilingTrapColor,
    } = useCanvasStore();

    const selectedWallId = useCanvasStore(state => state.selectedWallId);
    const selectedDesignAreaId = useCanvasStore(state => state.selectedDesignAreaId);

    const activeWall = walls.find(w => w.id === activeWallId);

    const [materialColorsData, setMaterialColorsData] = React.useState<Record<string, any[]>>({});
    const [isLoadingMaterials, setIsLoadingMaterials] = React.useState(false);
    const fetchedProductIds = React.useRef<Set<string>>(new Set());

    // All products used across all walls
    const usedProducts = useMemo(() => {
        const productIds = new Set<string>();
        walls.forEach(wall => {
            wall.designAreas.forEach(area => productIds.add(area.productId));
            wall.lists.forEach(list => productIds.add(list.productId));
        });
        return products.filter(p => productIds.has(p.id));
    }, [walls, products]);

    // Detect if any wall is a ceiling type
    const hasCeilingWalls = useMemo(() => walls.some((w: any) => w.type === 'ceiling'), [walls]);

    // Plafon products — only shown when there are ceiling walls
    const plafonProducts = useMemo(() => {
        if (!hasCeilingWalls) return [];
        return products.filter((p: any) => p.category?.toLowerCase() === 'plafon');
    }, [products, hasCeilingWalls]);

    // Name of the selected wall (for the banner)
    const selectedWallName = useMemo(() => {
        if (!selectedWallId) return null;
        return walls.find(w => w.id === selectedWallId)?.name || "Selected Wall";
    }, [selectedWallId, walls]);

    React.useEffect(() => {
        const fetchMaterialColors = async () => {
            const allProductsToFetch = [...usedProducts, ...plafonProducts];
            if (allProductsToFetch.length === 0) return;
            const newProducts = allProductsToFetch.filter(p => !fetchedProductIds.current.has(p.id));
            if (newProducts.length === 0) return;
            setIsLoadingMaterials(true);
            for (const product of newProducts) {
                fetchedProductIds.current.add(product.id);
                const { data, error } = await supabase
                    .from("material_colors")
                    .select("id, material_id, image")
                    .eq("material_id", product.id);
                if (data && !error) {
                    setMaterialColorsData(prev => ({ ...prev, [product.id]: data }));
                }
            }
            setIsLoadingMaterials(false);
        };
        fetchMaterialColors();
    }, [usedProducts, plafonProducts]);

    /**
     * Apply a color/texture with this priority:
     * 1. A specific rectangle is selected → set customColor on that ONE area
     * 2. A wall is selected (no specific rect) → set customColor on all areas of
     *    that product within that wall
     * 3. Nothing selected → change the product color globally (all walls)
     */
    const applyColor = (productId: string, color: string) => {
        if (selectedDesignAreaId) {
            // Priority 1: single rectangle
            setDesignAreaColor(selectedDesignAreaId, color);
        } else if (selectedWallId) {
            // Priority 2: all rects of this product inside the active wall
            setWallProductColor(selectedWallId, productId, color);
        } else {
            // Priority 3: global product color
            setProductColor(productId, color);
        }
    };

    const clearWallSelection = () => {
        setSelectedWallId(null);
        setSelectedDesignAreaId(null);
    };

    /**
     * Get the display color for a product's swatch:
     * 1. If a specific rect is selected, show that rect's customColor
     * 2. If a wall is selected, show the first matching area's customColor
     * 3. Fall back to global product color
     */
    const getDisplayColor = (productId: string) => {
        if (selectedDesignAreaId) {
            for (const wall of walls) {
                const area = wall.designAreas.find(a => a.id === selectedDesignAreaId);
                if (area) return (area as any).customColor || products.find(p => p.id === productId)?.color || '#cccccc';
            }
        }
        if (selectedWallId) {
            const wall = walls.find(w => w.id === selectedWallId);
            const area = wall?.designAreas.find(a => a.productId === productId);
            if (area && (area as any).customColor) return (area as any).customColor;
        }
        return products.find(p => p.id === productId)?.color || '#cccccc';
    };

    return (
        <div className="flex flex-col h-full w-full bg-white overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
                <MockupManager
                    mockups={mockupsList}
                    activeMockupId={activeMockupId}
                    addMockup={handleAddMockup}
                    removeMockup={handleRemoveMockup}
                    setActiveMockup={handleSetActiveMockup}
                    updateMockupName={handleUpdateMockupName}
                    duplicateMockup={handleDuplicateMockup}
                />
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-800">Material Colors</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        {selectedWallId
                            ? `Applying to "${selectedWallName}" only`
                            : "Click any rectangle to select its wall"}
                    </p>
                </div>

                {/* Selection banner */}
                {(selectedDesignAreaId || selectedWallId) && (
                    <div className={`mx-4 mt-4 p-3 rounded-xl flex items-center justify-between gap-2 border ${selectedDesignAreaId
                        ? 'bg-[#7B6DED]/10 border-[#7B6DED]/30'
                        : 'bg-green-50 border-green-200'
                        }`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${selectedDesignAreaId ? 'bg-[#7B6DED]' : 'bg-green-500'
                                }`}></span>
                            <div className="min-w-0">
                                <p className={`text-xs font-semibold truncate ${selectedDesignAreaId ? 'text-[#7B6DED]' : 'text-green-700'
                                    }`}>
                                    {selectedDesignAreaId
                                        ? 'One rectangle selected'
                                        : `${selectedWallName} — active`}
                                </p>
                                <p className={`text-[10px] mt-0.5 ${selectedDesignAreaId ? 'text-[#7B6DED]/70' : 'text-green-600'
                                    }`}>
                                    {selectedDesignAreaId
                                        ? 'Texture applies to this rectangle only'
                                        : 'Texture applies to this wall only'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={clearWallSelection}
                            className={`font-bold text-xs rounded-lg px-2 py-1 transition shrink-0 ${selectedDesignAreaId
                                ? 'text-[#7B6DED] bg-[#7B6DED]/10 hover:bg-[#7B6DED]/20'
                                : 'text-green-700 bg-green-100 hover:bg-green-200'
                                }`}
                        >
                            Clear
                        </button>
                    </div>
                )}

                <div className="p-4">
                    {isLoadingMaterials ? (
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex flex-col gap-2 p-3 border border-gray-100 rounded-md animate-pulse">
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                        <div className="w-8 h-8 rounded bg-gray-200"></div>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <div className="w-10 h-10 shrink-0 rounded bg-gray-200"></div>
                                        <div className="w-10 h-10 shrink-0 rounded bg-gray-200"></div>
                                        <div className="w-10 h-10 shrink-0 rounded bg-gray-200"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : usedProducts.length === 0 ? (
                        <p className="text-sm text-gray-500">No materials used in this project yet.</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {usedProducts.map(product => {
                                const displayColor = getDisplayColor(product.id);
                                const isHex = displayColor && !displayColor.startsWith("data:") && !displayColor.startsWith("http");

                                return (
                                    <div
                                        key={product.id}
                                        className="flex flex-col gap-2 p-3 border border-gray-100 rounded-lg "
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700 truncate mr-2" title={product.name}>
                                                {product.name}
                                            </span>
                                            <input
                                                type="color"
                                                value={isHex ? displayColor : "#cccccc"}
                                                onChange={e => applyColor(product.id, e.target.value)}
                                                className="w-10 h-10 cursor-pointer p-0 border-none bg-transparent appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                                            />
                                        </div>

                                        {materialColorsData[product.id] && materialColorsData[product.id].length > 0 && (
                                            <div className="flex gap-2 overflow-x-auto pb-1 mt-1 scrollbar-thin scrollbar-thumb-gray-200">
                                                {materialColorsData[product.id].map(mc => (
                                                    <button
                                                        key={mc.id}
                                                        onClick={() => applyColor(product.id, mc.image)}
                                                        className={`w-10 h-10 shrink-0 rounded border-2 overflow-hidden transition-transform hover:scale-105 ${displayColor === mc.image
                                                            ? 'border-[#7B6DED] scale-105'
                                                            : 'border-transparent hover:border-gray-300'
                                                            }`}
                                                        title="Apply Texture"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={mc.image} alt="Texture" className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Plafon section — shown only when ceiling walls are present */}
                {hasCeilingWalls && plafonProducts.length > 0 && (
                    <div className="p-4 border-t border-gray-100">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Tekstur Plafon</h3>
                        <div className="flex flex-col gap-4">
                            {plafonProducts.map((product: any) => {
                                const defaultColor = products.find((p: any) => p.id === product.id)?.color || '#ffffff';
                                const baseColor = (activeWall?.type === 'ceiling' && activeWall.ceilingBaseColor) ? activeWall.ceilingBaseColor : defaultColor;
                                const trapColor = (activeWall?.type === 'ceiling' && activeWall.ceilingTrapColor) ? activeWall.ceilingTrapColor : baseColor;
                                const hasTraps = (activeWall?.type === 'ceiling' && (activeWall.ceilingTraps?.length || 0) > 0);

                                const handleSetBaseColor = (c: string) => {
                                    if (activeWall?.type === 'ceiling') setCeilingBaseColor(activeWall.id, c);
                                    setProductColor(product.id, c);
                                };
                                const handleSetTrapColor = (c: string) => {
                                    if (activeWall?.type === 'ceiling') setCeilingTrapColor(activeWall.id, c);
                                };

                                return (
                                    <div key={product.id} className="flex flex-col gap-4 p-3 border border-indigo-100 rounded-lg bg-indigo-50/30">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-700 truncate mr-2" title={product.name}>
                                                    {product.name} {hasTraps ? '(Luar / Base)' : ''}
                                                </span>
                                                <input
                                                    type="color"
                                                    value={(!baseColor.startsWith("data:") && !baseColor.startsWith("http")) ? baseColor : "#ffffff"}
                                                    onChange={e => handleSetBaseColor(e.target.value)}
                                                    className="w-10 h-10 cursor-pointer p-0 border-none bg-transparent appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                                                />
                                            </div>
                                            {materialColorsData[product.id] && materialColorsData[product.id].length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto pb-1 mt-1 scrollbar-thin scrollbar-thumb-gray-200">
                                                    {materialColorsData[product.id].map((mc: any) => (
                                                        <button
                                                            key={mc.id}
                                                            onClick={() => handleSetBaseColor(mc.image)}
                                                            className={`w-10 h-10 shrink-0 rounded border-2 overflow-hidden transition-transform hover:scale-105 ${baseColor === mc.image
                                                                ? 'border-[#7B6DED] scale-105'
                                                                : 'border-transparent hover:border-gray-300'
                                                                }`}
                                                            title="Apply Texture to Base Ceiling"
                                                        >
                                                            <img src={mc.image} alt="Texture" className="w-full h-full object-cover" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {hasTraps && (
                                            <div className="flex flex-col gap-2 border-t border-indigo-100 pt-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-700 truncate mr-2" title="Trap Ceiling Material">
                                                        {product.name} (Dalam / Trap)
                                                    </span>
                                                    <input
                                                        type="color"
                                                        value={(!trapColor.startsWith("data:") && !trapColor.startsWith("http")) ? trapColor : "#ffffff"}
                                                        onChange={e => handleSetTrapColor(e.target.value)}
                                                        className="w-10 h-10 cursor-pointer p-0 border-none bg-transparent appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                                                    />
                                                </div>
                                                {materialColorsData[product.id] && materialColorsData[product.id].length > 0 && (
                                                    <div className="flex gap-2 overflow-x-auto pb-1 mt-1 scrollbar-thin scrollbar-thumb-gray-200">
                                                        {materialColorsData[product.id].map((mc: any) => (
                                                            <button
                                                                key={`trap-${mc.id}`}
                                                                onClick={() => handleSetTrapColor(mc.image)}
                                                                className={`w-10 h-10 shrink-0 rounded border-2 overflow-hidden transition-transform hover:scale-105 ${trapColor === mc.image
                                                                    ? 'border-[#7B6DED] scale-105'
                                                                    : 'border-transparent hover:border-gray-300'
                                                                    }`}
                                                                title="Apply Texture to Trap Ceiling"
                                                            >
                                                                <img src={mc.image} alt="Texture" className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
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
        </div>
    );
}
