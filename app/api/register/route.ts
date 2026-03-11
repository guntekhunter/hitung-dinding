import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// This route uses the SERVICE ROLE KEY which bypasses RLS entirely.
// It is safe because this runs server-side only and the key is never exposed to the browser.
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    console.log("--- POST /api/register start ---");
    try {
        const body = await req.json();
        console.log("Registration request body:", body);
        const { authUserId, companyName, adminName } = body;

        if (!authUserId || !companyName || !adminName) {
            console.error("Missing fields:", { authUserId, companyName, adminName });
            return NextResponse.json(
                { error: "Missing required fields: authUserId, companyName, adminName" },
                { status: 400 }
            );
        }

        // 1. Create the company (as admin, bypasses RLS)
        console.log("Attempting to create company:", companyName);
        const { data: newCompany, error: companyError } = await supabaseAdmin
            .from("companies")
            .insert([{ name: companyName }])
            .select()
            .single();

        if (companyError || !newCompany) {
            console.error("Company creation error:", companyError);
            return NextResponse.json(
                { error: "Failed to create company: " + (companyError?.message || "Unknown error") },
                { status: 500 }
            );
        }
        console.log("Company created successfully:", newCompany.id);

        // 2. Create the user profile linked to the new company (as admin, bypasses RLS)
        console.log("Attempting to create user profile for:", { authUserId, adminName, companyId: newCompany.id });
        const { data: newUserProfile, error: profileError } = await supabaseAdmin
            .from("users")
            .insert([{
                id: authUserId,
                company_id: newCompany.id,
                name: adminName,
                role: "admin",
            }])
            .select()
            .single();

        if (profileError || !newUserProfile) {
            console.error("Profile creation error:", profileError);
            // Rollback company if user profile fails
            console.log("Rolling back company:", newCompany.id);
            await supabaseAdmin.from("companies").delete().eq("id", newCompany.id);
            return NextResponse.json(
                { error: "Failed to create user profile: " + (profileError?.message || "Unknown error") },
                { status: 500 }
            );
        }
        console.log("User profile created successfully:", newUserProfile.id);

        return NextResponse.json({ company: newCompany, userProfile: newUserProfile });
    } catch (err: any) {
        console.error("API Error in /api/register:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    } finally {
        console.log("--- POST /api/register end ---");
    }
}
