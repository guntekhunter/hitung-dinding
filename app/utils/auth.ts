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
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) {
        throw new Error("Failed to fetch user profile: " + error.message);
    }

    return data;
};

export const getUserCompany = async (companyId: string) => {
    const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

    if (error) {
        throw new Error("Failed to fetch company info: " + error.message);
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
    // 1. Sign up the user FIRST so the Supabase client gets an authenticated session.
    // This resolves Row-Level Security (RLS) issues where anonymous users cannot insert companies.
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminData.email,
        password: adminData.password,
    });

    if (authError || !authData.user) {
        throw new Error("Authentication signup failed: " + (authError?.message || "Unknown error"));
    }

    // 2. Create the company now that we are authenticated
    const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert([{
            name: companyData.name
        }])
        .select()
        .single();

    if (companyError || !newCompany) {
        // Technically we have a dangling auth user now, but without a backend RPC this is the safest client-side approach.
        throw new Error("Failed to create company: " + (companyError?.message || "Unknown error"));
    }

    // 3. Create user profile linked to the new company
    const { data: newUserProfile, error: profileError } = await supabase
        .from("users")
        .insert([{
            id: authData.user.id,
            company_id: newCompany.id,
            name: adminData.name,
            role: "admin"
        }])
        .select()
        .single();

    if (profileError || !newUserProfile) {
        throw new Error("Failed to link user profile: " + (profileError?.message || "Unknown error"));
    }

    return { company: newCompany, userProfile: newUserProfile, authUser: authData.user };
};
