"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerCompanyAndAdminUser } from "../utils/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function RegisterPage() {
    const router = useRouter();
    const { user, company } = useAuthStore();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Redirect if already logged in
    useEffect(() => {
        if (user && company) {
            router.push("/");
        }
    }, [user, company, router]);

    const [companyName, setCompanyName] = useState("");
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await registerCompanyAndAdminUser(
                { name: companyName },
                { name: adminName, email: adminEmail, password: adminPassword }
            );
            alert("Akun berhasil dibuat! Silakan masuk.");
            router.push("/login");
        } catch (err: any) {
            setError(err.message || "Terjadi kesalahan saat registrasi.");
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass =
        "w-full px-3 py-2.5 border border-gray-200 placeholder-gray-300 text-gray-800 text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-[#826DF8] focus:border-[#826DF8]";
    const labelClass = "block text-sm text-gray-700 mb-1.5";

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f5] px-4 py-8">
            <div className="w-full max-w-[600px] bg-white rounded-md shadow-sm border border-gray-100 p-8 sm:p-12">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Buat Akun
                    </h1>
                    <p className="text-sm text-gray-500">
                        Daftarkan perusahaan & admin Anda
                    </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-8">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 flex gap-2 items-start">
                            <span className="text-rose-500 text-base leading-tight mt-px">⚠️</span>
                            <p className="text-sm text-rose-700 font-medium leading-snug">{error}</p>
                        </div>
                    )}

                    {/* Section 1: Company */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">
                            Data Perusahaan
                        </h2>
                        <div>
                            <label className={labelClass}>Nama Perusahaan</label>
                            <input
                                required
                                className={inputClass}
                                placeholder="Wallpanel wpc"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Section 2: Admin */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">
                            Data Administrator
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Nama Lngkap</label>
                                <input
                                    required
                                    className={inputClass}
                                    placeholder="Wallpanel wpc"
                                    value={adminName}
                                    onChange={(e) => setAdminName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Email</label>
                                <input
                                    required
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    className={inputClass}
                                    placeholder="Wallpanel wpc"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Password</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    autoComplete="new-password"
                                    className={inputClass}
                                    placeholder="Wallpanel wpc"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                />
                                <p className="text-xs text-gray-600 mt-1.5">Minimal 6 karakter</p>
                            </div>
                        </div>
                    </div>

                    {/* Submit & Links Section */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#826DF8] hover:bg-[#725cf6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#826DF8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Membuat akun...
                                </>
                            ) : (
                                "Daftar Sekarang"
                            )}
                        </button>

                        <p className="mt-4 text-sm text-gray-700">
                            Sudah punya akun?,{" "}
                            <Link
                                href="/login"
                                className="text-[#826DF8] hover:text-[#725cf6]"
                            >
                                masuk disini
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
