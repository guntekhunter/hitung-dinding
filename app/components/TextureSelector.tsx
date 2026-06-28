"use client";

import React, { useMemo } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";

export default function TextureSelector() {
    const { walls, products, setProductColor } = useCanvasStore();
    const [materialColorsData, setMaterialColorsData] = React.useState<Record<string, any[]>>({});
    const [isLoadingMaterials, setIsLoadingMaterials] = React.useState(false);
    const fetchedProductIds = React.useRef<Set<string>>(new Set());

    // Get all products used in the current design
    const usedProducts = useMemo(() => {
        const productIds = new Set<string>();
        walls.forEach(wall => {
            wall.designAreas.forEach(area => productIds.add(area.productId));
            wall.lists.forEach(list => productIds.add(list.productId));
        });
        return products.filter(p => productIds.has(p.id));
    }, [walls, products]);

    React.useEffect(() => {
        const fetchMaterialColors = async () => {
            if (usedProducts.length === 0) return;

            const newProducts = usedProducts.filter(p => !fetchedProductIds.current.has(p.id));
            if (newProducts.length === 0) return;

            setIsLoadingMaterials(true);

            for (const product of newProducts) {
                fetchedProductIds.current.add(product.id);
                const { data, error } = await supabase
                    .from("material_colors")
                    .select("id, material_id, image")
                    .eq("material_id", product.id);

                if (data && !error) {
                    setMaterialColorsData(prev => ({
                        ...prev,
                        [product.id]: data
                    }));
                }
            }
            setIsLoadingMaterials(false);
        };
        fetchMaterialColors();
    }, [usedProducts]);

    return (
        <div className="flex flex-col h-full w-full bg-white">
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Material Colors</h2>
                <p className="text-xs text-gray-500 mt-1">Change textures for the current project</p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
                {isLoadingMaterials ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 border border-gray-100 rounded-md shadow-sm animate-pulse">
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
                        {usedProducts.map((product) => (
                            <div key={product.id} className="flex flex-col gap-2 p-3 border border-gray-100 rounded-lg shadow-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 truncate mr-2" title={product.name}>
                                        {product.name}
                                    </span>
                                    <input
                                        type="color"
                                        value={
                                            product.color &&
                                                !product.color.startsWith("data:") &&
                                                !product.color.startsWith("http")
                                                ? product.color
                                                : "#cccccc"
                                        }
                                        onChange={(e) => setProductColor(product.id, e.target.value)}
                                        className="w-10 h-10 cursor-pointer p-0 border-none bg-transparent appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                                    />
                                </div>
                                {materialColorsData[product.id] && materialColorsData[product.id].length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-1 mt-1 scrollbar-thin scrollbar-thumb-gray-200">
                                        {materialColorsData[product.id].map(mc => (
                                            <button
                                                key={mc.id}
                                                onClick={() => setProductColor(product.id, mc.image)}
                                                className={`w-10 h-10 shrink-0 rounded border-2 overflow-hidden ${product.color === mc.image ? 'border-[#7B6DED]' : 'border-transparent hover:border-gray-300'}`}
                                                title="Apply Texture"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={mc.image} alt="Texture" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
