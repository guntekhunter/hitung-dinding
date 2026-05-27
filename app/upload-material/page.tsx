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
    const [imagePreview, setImagePreview] = useState<string | null>(null);
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
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit for base64 safety
                setStatus({ type: 'error', message: "File size exceeds 2MB limit. Please choose a smaller image." });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                setStatus({ type: null, message: '' });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedMaterial) {
            setStatus({ type: 'error', message: "Please select a material." });
            return;
        }
        if (!imagePreview) {
            setStatus({ type: 'error', message: "Please select an image." });
            return;
        }
        if (!user?.id) {
            setStatus({ type: 'error', message: "User not authenticated." });
            return;
        }

        setIsUploading(true);
        setStatus({ type: null, message: '' });

        try {
            const { error } = await supabase
                .from("material_colors")
                .insert({
                    material_id: selectedMaterial,
                    image: imagePreview,
                    user_id: user.id
                });

            if (error) throw error;

            setStatus({ type: 'success', message: "Material color uploaded successfully!" });
            
            // Reset form
            setSelectedMaterial("");
            setImagePreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setStatus({ type: 'error', message: error.message || "Failed to upload material color." });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ProtectedRoute>
            <div className="flex flex-col h-full bg-slate-50 p-6 md:p-10">
                <div className="max-w-2xl mx-auto w-full">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-slate-800">Upload Material Image</h1>
                        <p className="text-sm text-slate-500 mt-1">Add custom texture or color images to existing materials.</p>
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
                            <label className="text-sm font-semibold text-slate-700">Select Material</label>
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
                            <label className="text-sm font-semibold text-slate-700">Material Image</label>
                            <div 
                                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer relative overflow-hidden group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-[#7B6DED]">
                                            <ImageIcon className="w-6 h-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-700">Click to upload image</p>
                                            <p className="text-xs text-slate-500 mt-1">SVG, PNG, JPG or GIF (max. 2MB)</p>
                                        </div>
                                    </>
                                )}
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleImageChange}
                                />
                                {imagePreview && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">Change Image</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="w-full bg-[#7B6DED] hover:bg-[#6A5ED4] text-white py-3.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-sm shadow-[#7B6DED]/20"
                        >
                            {isUploading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    Upload Material
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
