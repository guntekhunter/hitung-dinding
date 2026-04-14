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

        const syncSession = async (sessionUser: any, retryCount = 0) => {
            if (!sessionUser) {
                if (isMounted) {
                    clearSession();
                    setIsLoading(false);
                }
                return;
            }

            try {
                // Fetch user profile from the 'users' table
                const profile = await getCurrentUser(sessionUser.id);
                if (!isMounted) return;

                // Fetch associated company data
                const company = await getUserCompany(profile.company_id);
                if (!isMounted) return;

                setSession(profile, company);
            } catch (error: any) {
                // Handling the "Registration Race":
                // If the profile isn't found immediately after a fresh sign-up,
                // wait 1.5s and retry once. The server-side /api/register might still be finishing.
                if (retryCount < 1 && error?.message?.includes("No user profile found")) {
                    console.warn(`Profile not found for ${sessionUser.id}, retrying in 1.5s...`);
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    if (isMounted) return syncSession(sessionUser, retryCount + 1);
                }

                console.error("Session sync error:", error?.message ?? error);
                
                // If there's a fatal error fetching the profile, ensure local state is cleared
                if (isMounted) {
                    clearSession();
                    setIsLoading(false);
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        // Initial check: getUser() validates the token with the server
        supabase.auth.getUser().then(({ data: { user }, error }) => {
            if (!isMounted) return;
            
            if (error) {
                // Handle "Invalid Refresh Token" or other terminal auth errors 
                // by purging the stale local session entirely.
                console.error("Auth initialization error:", error.message);
                if (error.message.includes("Refresh Token Not Found") || error.status === 401) {
                    supabase.auth.signOut({ scope: "local" });
                }
                clearSession();
                setIsLoading(false);
                return;
            }

            if (!user) {
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

            // Handle sign-in, token refresh, and initial session restoration
            if (
                event === "INITIAL_SESSION" ||
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED"
            ) {
                // Only trigger syncSession from the listener if it's NOT a restore event
                // (because getUser() above already triggers it for restores)
                // OR if the user just signed in/refreshed.
                if (event !== "INITIAL_SESSION") {
                    syncSession(session?.user);
                }
            } else if (event === "SIGNED_OUT") {
                clearSession();
                setIsLoading(false);
            }
        });

        // Safety timeout to prevent the app from hanging on network issues
        const timer = setTimeout(() => {
            if (isMounted && isLoading) {
                console.warn("Auth hydration safety timeout reached");
                setIsLoading(false);
            }
        }, 10000);

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
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-bold text-lg italic">Initializing...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
