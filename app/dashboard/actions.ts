"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function getDashboardData(userId: string) {
    if (!userId) {
        throw new Error("Unauthorized");
    }

    // 1. Verify user is super admin
    const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

    if (userError || !user || user.role !== "super admin") {
        throw new Error("Unauthorized");
    }

    // 2. Fetch subscriptions and join with users
    const { data: subscriptions, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select(`
            user_id,
            expired_at,
            created_at,
            users (
                name,
                wa_number
            )
        `);

    if (subError) {
        throw new Error("Failed to fetch subscriptions: " + subError.message);
    }

    // 3. Fetch auth users to get emails
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
        throw new Error("Failed to fetch auth users: " + authError.message);
    }
    
    const authUsers = authData?.users || [];

    // map email to user_id
    const emailMap = new Map();
    authUsers.forEach(u => emailMap.set(u.id, u.email));

    // format data
    const payingCustomers = (subscriptions || []).map(sub => {
        // Handle array or object return from Supabase join
        const userData = Array.isArray(sub.users) ? sub.users[0] : sub.users;
        return {
            user_id: sub.user_id,
            expired_at: sub.expired_at,
            created_at: sub.created_at,
            name: userData?.name || "-",
            wa_number: userData?.wa_number || "-",
            email: emailMap.get(sub.user_id) || "-"
        };
    });

    return payingCustomers;
}
