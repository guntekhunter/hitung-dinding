"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInUser, getCurrentUser, getUserCompany } from "../utils/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter();
    const setSession = useAuthStore((state) => state.setSession);
    const { user, company } = useAuthStore();

    useEffect(() => {
        if (user && company) {
            router.push("/wall-editor");
        }
    }, [user, company, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const authResponse = await signInUser(email, password);
            const userId = authResponse.user?.id;

            if (!userId) {
                throw new Error("Authentication failed. No user returned.");
            }

            const userProfile = await getCurrentUser(userId);

            if (!userProfile.company_id) {
                throw new Error("User profile is not associated with any company.");
            }

            const companyInfo = await getUserCompany(userProfile.company_id);

            setSession(userProfile, companyInfo);
            router.push("/");
        } catch (err: any) {
            console.error("Login process error:", err);
            const errorMessage =
                err.message ||
                (typeof err === "object" ? JSON.stringify(err) : String(err));
            setError(errorMessage);
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
                        Login
                    </h1>
                    <p className="text-sm text-gray-500">
                        Selamat datang kembali
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Error Banner */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-md p-3 flex gap-2 items-start">
                            <span className="text-rose-500 text-base leading-tight mt-px">⚠️</span>
                            <p className="text-sm text-rose-700 font-medium leading-snug">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Email */}
                        <div>
                            <label htmlFor="email-address" className={labelClass}>
                                Email
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                inputMode="email"
                                className={inputClass}
                                placeholder="Wallpanel wpc"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className={labelClass}>
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className={inputClass}
                                placeholder="Wallpanel wpc"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit */}
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
                                    Sedang masuk...
                                </>
                            ) : (
                                "Masuk"
                            )}
                        </button>

                        {/* Register Link */}
                        <p className="mt-4 text-sm text-gray-700">
                            Belum punya akun?,{" "}
                            <Link
                                href="/register"
                                className="text-[#826DF8] hover:text-[#725cf6]"
                            >
                                daftar disini
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
