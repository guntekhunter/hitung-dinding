"use client";

import React, { useState } from "react";
import { resetPassword } from "../utils/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);

        try {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
            await resetPassword(email, `${baseUrl}/update-password`);
            setMessage("Link reset password telah dikirim ke email Anda. Silakan cek kotak masuk Anda.");
        } catch (err: any) {
            setError(err.message || "Terjadi kesalahan saat mengirim link reset password.");
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
                        Lupa Password
                    </h1>
                    <p className={"text-sm text-gray-500"}>
                        Masukkan email Anda untuk mereset password
                    </p>
                </div>

                <form onSubmit={handleReset} className={"space-y-6"}>
                    {error && (
                        <div className={"bg-rose-50 border border-rose-200 rounded-md p-3 flex gap-2 items-start"}>
                            <span className={"text-rose-500 text-base leading-tight mt-px"}>⚠️</span>
                            <p className={"text-sm text-rose-700 font-medium leading-snug"}>{error}</p>
                        </div>
                    )}
                    {message && (
                        <div className={"bg-green-50 border border-green-200 rounded-md p-3 flex gap-2 items-start"}>
                            <span className={"text-green-500 text-base leading-tight mt-px"}>✅</span>
                            <p className={"text-sm text-green-700 font-medium leading-snug"}>{message}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor={"email-address"} className={labelClass}>
                            Email
                        </label>
                        <input
                            id={"email-address"}
                            name={"email"}
                            type={"email"}
                            autoComplete={"email"}
                            required
                            className={inputClass}
                            placeholder={"Masukkan email Anda"}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className={"pt-2"}>
                        <button
                            type={"submit"}
                            disabled={isLoading}
                            className={"w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#826DF8] hover:bg-[#725cf6] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#826DF8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"}
                        >
                            {isLoading ? "Mengirim..." : "Kirim Link Reset"}
                        </button>

                        <div className={"mt-4 text-center"}>
                            <Link href={"/login"} className={"text-sm text-[#826DF8] hover:text-[#725cf6]"}>
                                Kembali ke Login
                            </Link>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}