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
        "w-full px-4 py-3.5 border border-slate-300 placeholder-slate-400 text-slate-900 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm";
    const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-8 sm:py-16">
            {/* Brand Header */}
            <div className="mb-6 sm:mb-8 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                    Wall Planner
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Multi-company RAB Generator
                </p>
            </div>

            {/* Card */}
            <div className="w-full max-w-sm sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 px-5 py-7 sm:px-8 sm:py-9">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mb-1">
                    Buat akun baru
                </h2>
                <p className="text-sm text-slate-500 mb-6">
                    Daftarkan perusahaan & admin Anda
                </p>

                <form onSubmit={handleRegister} className="space-y-5">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2 items-start">
                            <span className="text-rose-500 text-base leading-tight mt-px">⚠️</span>
                            <p className="text-sm text-rose-700 font-medium leading-snug">{error}</p>
                        </div>
                    )}

                    {/* Section 1: Company */}
                    <div>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3">
                            1 · Data Perusahaan
                        </p>
                        <div>
                            <label className={labelClass}>Nama Perusahaan</label>
                            <input
                                required
                                className={inputClass}
                                placeholder="PT. Maju Jaya Interior"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-100" />

                    {/* Section 2: Admin */}
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                            2 · Data Administrator
                        </p>

                        <div>
                            <label className={labelClass}>Nama Lengkap</label>
                            <input
                                required
                                className={inputClass}
                                placeholder="Budi Santoso"
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
                                placeholder="budi@perusahaan.com"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    minLength={6}
                                    autoComplete="new-password"
                                    className={`${inputClass} pr-12`}
                                    placeholder="Min. 6 karakter"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 touch-manipulation"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 ml-1">Minimum 6 karakter</p>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
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

                    {/* Login Link */}
                    <p className="text-center text-sm text-slate-500 pt-1">
                        Sudah punya akun?{" "}
                        <Link
                            href="/login"
                            className="font-bold text-indigo-600 hover:text-indigo-500 underline-offset-2 hover:underline"
                        >
                            Masuk di sini
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
