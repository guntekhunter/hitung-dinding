"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";
import { getDashboardData, sendResetPasswordEmail } from "./actions";
import { Users, DollarSign, Activity, KeyRound, Loader2, Check } from "lucide-react";


type Customer = {
    user_id: string;
    expired_at: string;
    created_at: string;
    name: string;
    wa_number: string;
    email: string;
};

export default function DashboardPage() {
    const { user } = useAuthStore();
    const router = useRouter();
    
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
    const [statusFeedback, setStatusFeedback] = useState<{ [key: string]: { type: "success" | "error"; message: string } }>({});

    const handleSendResetPassword = async (customer: Customer) => {
        if (!user || !customer.email || customer.email === "-") {
            alert("No valid email address found for this user.");
            return;
        }

        const confirmSend = window.confirm(`Send password reset email to ${customer.email}?`);
        if (!confirmSend) return;

        setSendingEmailId(customer.user_id);
        setStatusFeedback((prev) => ({ ...prev, [customer.user_id]: undefined as any }));

        try {
            const origin = typeof window !== "undefined" ? window.location.origin : undefined;
            await sendResetPasswordEmail(user.id, customer.email, origin);
            setStatusFeedback((prev) => ({
                ...prev,
                [customer.user_id]: { type: "success", message: "Email sent!" },
            }));
            setTimeout(() => {
                setStatusFeedback((prev) => {
                    const updated = { ...prev };
                    delete updated[customer.user_id];
                    return updated;
                });
            }, 4000);
        } catch (err: any) {
            setStatusFeedback((prev) => ({
                ...prev,
                [customer.user_id]: {
                    type: "error",
                    message: err.message || "Failed to send reset email",
                },
            }));
        } finally {
            setSendingEmailId(null);
        }
    };

    useEffect(() => {
        if (!user) return; // Wait for auth hydration

        if (user.role !== "super admin") {
            router.push("/home");
            return;
        }

        const fetchData = async () => {
            try {
                const data = await getDashboardData(user.id);
                setCustomers(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load dashboard data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user, router]);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (user.role !== "super admin") {
        return null; // Will redirect in useEffect
    }

    const totalCustomers = customers.length;
    const PLAN_PRICE = 89999;
    const GATEWAY_FEE_RATE = 0.0181; // 1.81% payment gateway admin fee
    const grossRevenue = totalCustomers * PLAN_PRICE;
    const gatewayFee = grossRevenue * GATEWAY_FEE_RATE;
    const totalRevenue = grossRevenue - gatewayFee;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
                <p className="text-slate-500 mt-2">Manage your subscriptions and revenue.</p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Paying Customers</p>
                                <p className="text-2xl font-bold text-slate-900">{totalCustomers}</p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-500">Net Revenue (Monthly)</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {new Intl.NumberFormat("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        minimumFractionDigits: 0
                                    }).format(totalRevenue)}
                                </p>
                                <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                                    <p>
                                        Gross: {new Intl.NumberFormat("id-ID", {
                                            style: "currency",
                                            currency: "IDR",
                                            minimumFractionDigits: 0
                                        }).format(grossRevenue)}
                                    </p>
                                    <p className="text-red-400">
                                        − Payment gateway fee (1.81%): {new Intl.NumberFormat("id-ID", {
                                            style: "currency",
                                            currency: "IDR",
                                            minimumFractionDigits: 0
                                        }).format(gatewayFee)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Subscription Plan</p>
                                <p className="text-2xl font-bold text-slate-900">Rp 89.999</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Manual activation form */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-lg font-medium text-slate-800 mb-2">Manual Activation</h3>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.currentTarget as HTMLFormElement;
                                const merchant = (form.elements.namedItem('merchant') as HTMLInputElement).value.trim();
                                const reference = (form.elements.namedItem('reference') as HTMLInputElement).value.trim();
                                if (!merchant) {
                                    alert('Merchant Order ID required');
                                    return;
                                }
                                try {
                                    const res = await fetch('/api/manual-activate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ merchantOrderId: merchant, reference: reference || undefined }),
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                        alert('Activation successful: ' + data.message);
                                        router.refresh();
                                    } else {
                                        alert('Activation failed: ' + (data.message || 'Unknown error'));
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Activation error');
                                }
                            }}
                            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                            <input
                                type="text"
                                name="merchant"
                                placeholder="Merchant Order ID (e.g., ORD-XXXX)"
                                className="border rounded px-3 py-2 focus:outline-none focus:ring"
                            />
                            <input
                                type="text"
                                name="reference"
                                placeholder="PG Transaction ID (optional)"
                                className="border rounded px-3 py-2 focus:outline-none focus:ring"
                            />
                            <button
                                type="submit"
                                className="col-span-2 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                            >
                                Activate Account
                            </button>
                        </form>
                    </div>
                        <div className="px-6 py-4 border-b border-slate-200">
                            <h2 className="text-lg font-semibold text-slate-800">Paying Customers List</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500">Name</th>
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500">Email</th>
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500">WhatsApp</th>
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500">Created At</th>
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500">Expired At</th>
                                        <th className="px-6 py-4 text-sm font-medium text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {customers.length > 0 ? (
                                        customers.map((customer) => {
                                            const isSending = sendingEmailId === customer.user_id;
                                            const feedback = statusFeedback[customer.user_id];
                                            const hasEmail = customer.email && customer.email !== "-";

                                            return (
                                                <tr key={customer.user_id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{customer.name}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{customer.email}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{customer.wa_number}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString("id-ID") : "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {customer.expired_at ? new Date(customer.expired_at).toLocaleDateString("id-ID") : "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {feedback && (
                                                                <span
                                                                    className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${
                                                                        feedback.type === "success"
                                                                            ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                                                            : "text-red-700 bg-red-50 border border-red-200"
                                                                    }`}
                                                                >
                                                                    {feedback.type === "success" && <Check className="w-3 h-3" />}
                                                                    {feedback.message}
                                                                </span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                disabled={isSending || !hasEmail}
                                                                onClick={() => handleSendResetPassword(customer)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                title={!hasEmail ? "No email available" : "Send reset password email"}
                                                            >
                                                                {isSending ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <KeyRound className="w-3.5 h-3.5" />
                                                                )}
                                                                <span>{isSending ? "Sending..." : "Reset Password"}</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">
                                                No paying customers found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
