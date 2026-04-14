import { supabase } from "../../lib/supabase";

export const signInUser = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        throw new Error(error.message);
    }

    return data;
};

export const getCurrentUser = async (userId: string) => {
    console.log("Fetching profile for userId:", userId);
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("getCurrentUser error:", {
            message: error.message,
            code:    (error as any).code,
            details: (error as any).details,
            hint:    (error as any).hint,
        });
        throw new Error(
            "Failed to fetch user profile: " +
            (error.message || (error as any).code || JSON.stringify(error))
        );
    }

    if (!data) {
        throw new Error(
            "No user profile found. Your account may not have completed registration. Please contact support or try re-registering."
        );
    }

    return data;
};

export const getUserCompany = async (companyId: string) => {
    console.log("Fetching company for companyId:", companyId);
    const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

    if (error) {
        console.error("getUserCompany error:", {
            message: error.message,
            code:    (error as any).code,
            details: (error as any).details,
            hint:    (error as any).hint,
        });
        throw new Error(
            "Failed to fetch company info: " +
            (error.message || (error as any).code || JSON.stringify(error))
        );
    }

    if (!data) {
        throw new Error("Company not found. Please contact support.");
    }

    return data;
};

export const logoutUser = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(error.message);
    }
};

export const registerCompanyAndAdminUser = async (
    companyData: { name: string },
    adminData: { name: string; email: string; password: string }
) => {
    // 1. Sign up the auth user via Supabase Auth (client-side, anon key is fine here)
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
    });

    if (authError || !authData.user) {
        throw new Error("Authentication signup failed: " + (authError?.message || "Unknown error"));
    }

    // 2. Call our server-side API route that uses the SERVICE ROLE KEY to bypass RLS.
    // This is necessary because after signUp, if email confirmation is enabled,
    // the session is null and the client is still "anon" (not "authenticated"),
    // causing the INSERT RLS policy to reject the request.
    const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            authUserId: authData.user.id,
            companyName: companyData.name,
            adminName: adminData.name,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to complete registration on server.");
    }

    const { company: newCompany, userProfile: newUserProfile } = await response.json();

    return { company: newCompany, userProfile: newUserProfile, authUser: authData.user };
};
