"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { getCurrentUser, getUserCompany } from "../utils/auth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setSession, clearSession } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const hydrateSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const profile = await getCurrentUser(session.user.id);
                    if (profile) {
                        const company = await getUserCompany(profile.company_id);
                        if (company) {
                            setSession(profile, company);
                        }
                    }
                } else {
                    clearSession();
                }
            } catch (error) {
                console.error("Session hydration error:", error);
                clearSession();
            } finally {
                setIsLoading(false);
            }
        };

        hydrateSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await getCurrentUser(session.user.id);
                if (profile) {
                    const company = await getUserCompany(profile.company_id);
                    if (company) {
                        setSession(profile, company);
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                clearSession();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [setSession, clearSession]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-bold text-lg">Initializing...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
