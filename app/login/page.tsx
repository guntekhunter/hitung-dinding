"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInUser, getCurrentUser, getUserCompany } from "../utils/auth";
import { useAuthStore } from "../store/useAuthStore";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const setSession = useAuthStore((state) => state.setSession);
    const { user, company } = useAuthStore();

    useEffect(() => {
        if (user && company) {
            router.push("/");
        }
    }, [user, company, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            // 1. Authenticate with Supabase
            const authResponse = await signInUser(email, password);
            const userId = authResponse.user?.id;

            if (!userId) {
                throw new Error("Authentication failed. No user returned.");
            }

            // 2. Fetch User Profile
            const userProfile = await getCurrentUser(userId);

            if (!userProfile.company_id) {
                throw new Error("User profile is not associated with any company.");
            }

            // 3. Fetch Company Info
            const companyInfo = await getUserCompany(userProfile.company_id);

            // 4. Hydrate global store
            setSession(userProfile, companyInfo);

            // 5. Redirect to Dashboard
            router.push("/");
        } catch (err: any) {
            console.error("Login process error:", err);
            // If it's a Supabase error object, it might have a message property
            const errorMessage = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-black text-slate-800 tracking-tight">
                        Sign in to your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-500">
                        Multi-company Wall Planner & RAB Generator
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md">
                            <div className="flex items-center">
                                <div className="flex-shrink-0 text-rose-500">⚠️</div>
                                <div className="ml-3">
                                    <p className="text-sm text-rose-700 font-medium">
                                        {error}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1" htmlFor="email-address">
                                Email Address
                            </label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-shadow shadow-sm"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm transition-shadow shadow-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
