"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "../utils/auth";
import { supabase } from "../../lib/supabase";

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError("Sesi tidak valid atau telah kedaluwarsa. Silakan minta link reset password baru.");
            }
        };
        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Password tidak cocok.");
            return;
        }

        setIsLoading(true);
        try {
            await updatePassword(password);
            alert("Password berhasil diperbarui. Silakan login dengan password baru Anda.");
            router.push(`/login`);
        } catch (err: any) {
            setError(err.message || "Terjadi kesalahan saat memperbarui password.");
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = "w-full px-3 py-2.5 border border-gray-200 placeholder-gray-300 text-gray-800 text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-[#826DF8] focus:border-[#826DF8]";
    const labelClass = "block text-sm text-gray-700 mb-1.5";

    return (
        <div className={"min-h-screen flex flex-col items-center justify-center bg-[#f5f5f5] px-4 py-8"}>
            <div className={"w-full max-w-150 bg-white rounded-md shadow-sm border border-gray-100 p-8 sm:p-12"}>
                <div className={"text-center mb-10"}>
                    <h1 className={"text-3xl font-bold text-gray-800 mb-2"}>
                        Update Password
                    </h1>
                    <p className={"text-sm text-gray-500"}>
                        Masukkan password baru Anda
                    </p>
                </div>

                <form onSubmit={handleUpdate} className={"space-y-6"}>
                    {error && (
                        <div className={"bg-rose-50 border border-rose-200 rounded-md p-3 flex gap-2 items-start"}>
                            <span className={"text-rose-500 text-base leading-tight mt-px"}>⚠️</span>
                            <p className={"text-sm text-rose-700 font-medium leading-snug"}>{error}</p>
                        </div>
                    )}

                    <div className={"space-y-4"}>
                        <div>
                            <label htmlFor={"password"} className={labelClass}>
                                Password Baru
                            </label>
                            <input
                                id={"password"}
                                name={"password"}
                                type={"password"}
                                required
                                className={inputClass}
                                placeholder={"Masukkan password baru"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor={"confirm-password"} className={labelClass}>
                                Konfirmasi Password Baru
                            </label>
                            <input
                                id={"confirm-password"}
                                name={"confirm-password"}
                                type={"password"}
                                required
                                className={inputClass}
                                placeholder={"Ulangi password baru"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className={"pt-2"}>
                        <button
                            type={"submit"}
                            disabled={isLoading}
                            className={"w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#826DF8] hover:bg-[#725cf6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#826DF8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"}
                        >
                            {isLoading ? "Memperbarui..." : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}