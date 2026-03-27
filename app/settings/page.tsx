"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
    const { user, company, setSession } = useAuthStore();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) {
            router.push("/login");
        }
        if (company?.logo_url) {
            setPreviewUrl(company.logo_url);
        }
    }, [user, company, router]);

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 400; // Limit width to keep base64 string small
                    const MAX_HEIGHT = 400; // Limit height

                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject(new Error("No 2D context"));

                    // Fill white background for transparent PNGs before converting to JPEG
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillRect(0, 0, width, height);

                    ctx.drawImage(img, 0, 0, width, height);

                    // Output as JPEG, 0.7 quality to save massive space
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                    resolve(dataUrl);
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg("");
        setSuccessMsg("");
        
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setErrorMsg("Please upload an image file (PNG/JPG).");
            return;
        }

        try {
            // Preview it first
            const base64Data = await compressImage(file);
            setPreviewUrl(base64Data);
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to process image.");
        }
    };

    const handleSave = async () => {
        if (!company) return;
        if (!previewUrl) return;

        setIsSaving(true);
        setErrorMsg("");
        setSuccessMsg("");

        try {
            const response = await fetch("/api/company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyId: company.id,
                    logoUrl: previewUrl,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update logo via API");
            }

            // Update auth store with new logo URL
            setSession(user!, { ...company, logo_url: previewUrl });
            setSuccessMsg("Company logo updated successfully!");
        } catch (err: any) {
            console.error("Failed to save logo:", err);
            setErrorMsg(err.message || "An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user || !company) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl">
                <div className="mb-6 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Company Settings</h1>
                    <Link href="/" className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold hover:bg-indigo-200 transition-colors">
                        ← Back to Editor
                    </Link>
                </div>

                <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Company Logo</h2>
                    <p className="text-sm text-slate-500 mb-6">
                        This logo will appear on the top-left corner of the generated RAB PDF.
                        For best results, use a wide or square image with a light background.
                    </p>

                    <div className="mb-8 flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1 w-full space-y-4">
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">
                                Upload New Logo
                            </label>
                            
                            <input 
                                type="file" 
                                accept="image/png, image/jpeg, image/jpg"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-600 font-bold p-8 rounded-xl hover:bg-indigo-100 hover:border-indigo-300 transition-colors flex flex-col items-center justify-center gap-2"
                            >
                                <span className="text-3xl mb-2">📤</span>
                                Click to select an image
                            </button>
                        </div>

                        <div className="flex-1 w-full">
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest mb-4">
                                Preview
                            </label>
                            <div className="border border-slate-200 rounded-xl bg-slate-50 h-40 flex items-center justify-center overflow-hidden">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Company Logo Preview" className="max-h-full max-w-full object-contain p-2" />
                                ) : (
                                    <span className="text-slate-400 font-medium italic text-sm">No logo uploaded yet</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="mb-4 p-4 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold flex items-center gap-2">
                            <span>⚠️</span> {errorMsg}
                        </div>
                    )}
                    
                    {successMsg && (
                        <div className="mb-4 p-4 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold flex items-center gap-2">
                            <span>✅</span> {successMsg}
                        </div>
                    )}

                    <div className="border-t border-slate-100 pt-6 mt-6 flex justify-end">
                        <button 
                            onClick={handleSave}
                            disabled={isSaving || !previewUrl}
                            className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-md ${
                                isSaving || !previewUrl 
                                    ? "bg-slate-300 cursor-not-allowed" 
                                    : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95"
                            }`}
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
