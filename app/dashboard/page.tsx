"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";
import { getDashboardData } from "./actions";
import { Users, DollarSign, Activity } from "lucide-react";


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
    const totalRevenue = totalCustomers * PLAN_PRICE;

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

                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Revenue (Monthly)</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {new Intl.NumberFormat("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        minimumFractionDigits: 0
                                    }).format(totalRevenue)}
                                </p>
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {customers.length > 0 ? (
                                        customers.map((customer) => (
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
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
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
