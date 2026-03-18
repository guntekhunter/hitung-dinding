"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, company } = useAuthStore();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (!user || !company) {
            router.push("/login");
        } else {
            setIsChecking(false);
        }
    }, [user, company, router]);

    if (!user || !company) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-medium italic">
                Redirecting to login...
            </div>
        );
    }

    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Verifying session...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
