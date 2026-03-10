"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerCompanyAndAdminUser } from "../utils/auth";
import Link from "next/link";

export default function RegisterPage() {
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [companyName, setCompanyName] = useState("");

    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await registerCompanyAndAdminUser(
                {
                    name: companyName
                },
                {
                    name: adminName,
                    email: adminEmail,
                    password: adminPassword,
                }
            );

            // Redirect to login after successful creation
            // Note: Since we don't automatically hydrate the store here to stay decoupled,
            // we send them to login so they can verify and initialize the session cleanly.
            alert("Account created successfully! Please sign in.");
            router.push("/login");
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during registration.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mt-10 mb-10">
                <div>
                    <h2 className="mt-2 text-center text-3xl font-black text-slate-800 tracking-tight">
                        Create New SaaS Account
                    </h2>
                    <p className="mt-2 text-center text-sm text-slate-500">
                        Join our Multi-company Wall Planner & RAB Generator
                    </p>
                </div>

                <form className="mt-8 space-y-8" onSubmit={handleRegister}>
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

                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">1. Company Details</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Company Name</label>
                                <input
                                    required
                                    className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                                    placeholder="Acme Interiors Ltd."
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-slate-800 border-b pb-2">2. Administrator Details</h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Your Name</label>
                                <input
                                    required
                                    className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                                    placeholder="John Doe"
                                    value={adminName}
                                    onChange={(e) => setAdminName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                                <input
                                    required
                                    type="email"
                                    className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                                    placeholder="john@acme.com"
                                    value={adminEmail}
                                    onChange={(e) => setAdminEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    className="appearance-none relative block w-full px-3 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-shadow shadow-sm"
                                    placeholder="••••••••"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? "Creating Account..." : "Create Account & Register"}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-slate-500">Already have an account? </span>
                        <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-500">
                            Sign in here
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
