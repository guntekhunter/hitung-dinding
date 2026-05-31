"use client";

import React, { useMemo } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, Download } from "lucide-react";
import { saveProjectToDatabase } from "../utils/saveProject";
import { useAuthStore } from "../store/useAuthStore";
import { supabase } from "../../lib/supabase";

export default function ColoringToolbar({ wallEditorRef }: any) {
    const router = useRouter();
    const { walls, products, setProductColor, customerInfo, materialPrices, projectId } = useCanvasStore();
    const company = useAuthStore(state => state.company);
    const [isSaving, setIsSaving] = React.useState(false);
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
                // Mark as fetched so we don't fetch again
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

    const handleSave = async () => {
        if (!company?.id || !projectId) return;
        setIsSaving(true);

        try {
            const { data: existingProject, error } = await supabase
                .from("projects")
                .select("name, data")
                .eq("id", projectId)
                .single();

            if (error || !existingProject) throw new Error("Project not found");

            const customColors: Record<string, string> = {};
            usedProducts.forEach(p => {
                customColors[p.id] = p.color;
            });

            const projectData = {
                ...existingProject.data,
                canvas: { walls },
                materialColors: customColors
            };

            await saveProjectToDatabase(
                existingProject.name,
                projectData,
                company.id,
                projectId
            );
            alert("Project colors saved!");
        } catch (error) {
            console.error("Save failed:", error);
            alert("Failed to save project.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = () => {
        useCanvasStore.getState().setIsExporting(true);
        // Wait for React to re-render and hide the dashed lines
        setTimeout(() => {
            const stage = wallEditorRef.current?.getStage();
            if (stage) {
                const dataURL = stage.toDataURL({ pixelRatio: 2 });
                const link = document.createElement("a");
                link.download = "wall-design.png";
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            useCanvasStore.getState().setIsExporting(false);
        }, 150);
    };

    return (
        <div className="flex flex-col h-full bg-white relative w-full md:w-[320px]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <button
                    onClick={() => router.push('/projects')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Projects
                </button>
            </div>
            <div className="p-4 flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={handleDownload}
                        className="flex bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-[5px] items-center gap-2 hover:bg-gray-50 duration-300 text-sm font-medium"
                    >
                        <Download className="w-[1rem]" />
                        Download
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex bg-[#7B6DED] text-white py-1.5 px-3 rounded-[5px] items-center gap-2 hover:bg-[#6859d9] duration-300 disabled:opacity-50 text-sm font-medium"
                    >
                        <Save className="w-[1rem]" />
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
                <h2 className="text-lg font-bold mb-4 text-gray-800">Material Colors</h2>
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
                                    {/* <input
                                        type="color"
                                        value={product.color && !product.color.startsWith('data:') && !product.color.startsWith('http') ? product.color : "#cccccc"}
                                        onChange={(e) => setProductColor(product.id, e.target.value)}
                                        className="w-8 h-8 rounded-md cursor-pointer border-0 p-0"
                                        title="Pick solid color"
                                    /> */}
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
