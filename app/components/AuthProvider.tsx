"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";
import { getCurrentUser, getUserCompany } from "../utils/auth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const { setSession, clearSession } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const syncSession = async (sessionUser: any) => {
            if (!sessionUser) {
                clearSession();
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                const profile = await getCurrentUser(sessionUser.id);
                if (profile && isMounted) {
                    const company = await getUserCompany(profile.company_id);
                    if (company && isMounted) {
                        setSession(profile, company);
                    }
                }
            } catch (error) {
                console.error("Session sync error:", error);
                clearSession();
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        // Initial hydration
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (isMounted) syncSession(session?.user);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (isMounted) {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    syncSession(session?.user);
                } else if (event === 'SIGNED_OUT') {
                    clearSession();
                    setIsLoading(false);
                }
            }
        });

        // Safety timeout to prevent hanging indefinitely
        const timer = setTimeout(() => {
            if (isMounted && isLoading) {
                console.warn("Auth hydration safety timeout reached");
                setIsLoading(false);
            }
        }, 5000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(timer);
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
