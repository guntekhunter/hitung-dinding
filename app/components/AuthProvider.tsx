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
                if (isMounted) {
                    clearSession();
                    setIsLoading(false);
                }
                return;
            }

            try {
                const profile = await getCurrentUser(sessionUser.id);
                if (!isMounted) return;

                const company = await getUserCompany(profile.company_id);
                if (!isMounted) return;

                setSession(profile, company);
            } catch (error: any) {
                console.error("Session sync error:", error?.message ?? error);
                if (isMounted) clearSession();
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        // ✅ Use getUser() instead of getSession().
        //    getUser() validates the JWT with the Supabase auth server, so stale/expired
        //    tokens are detected here rather than causing mystery errors downstream.
        supabase.auth.getUser().then(({ data: { user }, error }) => {
            if (!isMounted) return;
            if (error || !user) {
                // Token was invalid – clear any stale local session
                supabase.auth.signOut({ scope: "local" });
                clearSession();
                setIsLoading(false);
                return;
            }
            syncSession(user);
        });

        // Listen for auth state changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            // Handle both initial restore and subsequent sign-ins / token refreshes
            if (
                event === "INITIAL_SESSION" ||
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED"
            ) {
                // Only sync if getUser() hasn't already done so (loading is still true)
                // or if this is a fresh SIGNED_IN event after the page loaded.
                if (event !== "INITIAL_SESSION") {
                    syncSession(session?.user);
                }
            } else if (event === "SIGNED_OUT") {
                clearSession();
                setIsLoading(false);
            }
        });

        // Safety timeout – prevents the app hanging on network issues
        const timer = setTimeout(() => {
            if (isMounted && isLoading) {
                console.warn("Auth hydration timeout – clearing session");
                clearSession();
                setIsLoading(false);
            }
        }, 8000);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600 font-bold text-lg">Memuat...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
