"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import ProtectedRoute from "../components/ProtectedRoute";
import { Upload, Image as ImageIcon, CheckCircle, AlertCircle } from "lucide-react";

type Material = {
    id: string;
    name: string;
};

export default function UploadMaterialPage() {
    const { user } = useAuthStore();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<string>("");
    const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchMaterials() {
            const { data, error } = await supabase
                .from("materials")
                .select("id, name")
                .order("name");
            
            if (data && !error) {
                setMaterials(data);
            }
        }
        fetchMaterials();
    }, []);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        let hasError = false;
        const validFiles = files.filter(file => {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                hasError = true;
                return false;
            }
            return true;
        });

        if (hasError) {
            setStatus({ type: 'error', message: "One or more files exceed the 2MB limit and were skipped." });
        } else {
            setStatus({ type: null, message: '' });
        }

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => [...prev, { file, preview: reader.result as string }]);
            };
            reader.readAsDataURL(file);
        });
        
        // Reset file input so same files can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!selectedMaterial) {
            setStatus({ type: 'error', message: "Please select a material." });
            return;
        }
        if (images.length === 0) {
            setStatus({ type: 'error', message: "Please select at least one image." });
            return;
        }
        if (!user?.id) {
            setStatus({ type: 'error', message: "User not authenticated." });
            return;
        }

        setIsUploading(true);
        setStatus({ type: null, message: '' });

        try {
            let successCount = 0;
            
            // Upload sequentially to avoid overloading the Cloudinary API or Database
            for (const img of images) {
                // 1. Upload to Cloudinary
                const uploadRes = await fetch('/api/upload-cloudinary', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ file: img.preview, folder: 'motif' }),
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) {
                    throw new Error(uploadData.error || "Failed to upload image to Cloudinary");
                }

                const imageUrl = uploadData.url;

                // 2. Save to Supabase
                const { error } = await supabase
                    .from("material_colors")
                    .insert({
                        material_id: selectedMaterial,
                        image: imageUrl,
                        user_id: user.id
                    });

                if (error) throw error;
                successCount++;
            }

            setStatus({ type: 'success', message: `Successfully uploaded ${successCount} material color(s)!` });
            
            // Reset images (keep material selected for quick successive uploads)
            setImages([]);
        } catch (error: any) {
            console.error("Upload error:", error);
            setStatus({ type: 'error', message: error.message || "Failed to upload one or more material colors." });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50 p-6 md:p-10 overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full pb-20">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-800">Upload Material Image</h1>
                        <p className="text-sm text-slate-500 mt-1">Bulk upload custom texture or color images to existing materials.</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col gap-6">
                        
                        {status.type && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                {status.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                                {status.message}
                            </div>
                        )}

                        {/* Material Selection */}
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700">Select Material Category</label>
                            <select 
                                value={selectedMaterial}
                                onChange={(e) => setSelectedMaterial(e.target.value)}
                                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#7B6DED]/20 focus:border-[#7B6DED] outline-none transition-all appearance-none bg-white"
                            >
                                <option value="" disabled>-- Choose a material --</option>
                                {materials.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Image Upload */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-slate-700">Material Images (Bulk Upload)</label>
                                <span className="text-xs font-medium text-slate-400">{images.length} selected</span>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group shadow-sm">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img.preview} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeImage(idx)}
                                            title="Remove image"
                                            className="absolute top-2 right-2 bg-black/60 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90 shadow-sm"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                
                                <div 
                                    className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-6 h-6 text-slate-400" />
                                    <span className="text-xs font-medium">{images.length > 0 ? "Add More" : "Upload Images"}</span>
                                </div>
                            </div>
                            
                            <p className="text-xs text-slate-500 mt-1">SVG, PNG, JPG or GIF (max. 2MB each)</p>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                accept="image/*"
                                multiple 
                                className="hidden" 
                                onChange={handleImageChange}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleUpload}
                            disabled={isUploading || images.length === 0}
                            className="w-full bg-[#7B6DED] hover:bg-[#6A5ED4] text-white py-3.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-sm shadow-[#7B6DED]/20"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Uploading {images.length} item(s)...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Upload {images.length > 0 ? `${images.length} ` : ''}Material(s)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
