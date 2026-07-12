import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { companyId, logoUrl, name, userId } = body;

        if (!companyId || !userId) {
            return NextResponse.json(
                { error: "Missing required fields: companyId or userId" },
                { status: 400 }
            );
        }

        // Verify user's connection to the company
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("company_id")
            .eq("id", userId)
            .single();

        if (userError || !userData || userData.company_id !== companyId) {
            return NextResponse.json(
                { error: "Unauthorized: You do not have permission to modify this company" },
                { status: 403 }
            );
        }

        const updateData: any = {};
        if (logoUrl !== undefined) updateData.logo_url = logoUrl;
        if (name !== undefined) updateData.name = name;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: "Nothing to update" },
                { status: 400 }
            );
        }

        // Use service role key to bypass RLS for UPDATE
        const { data, error } = await supabaseAdmin
            .from("companies")
            .update(updateData)
            .eq("id", companyId)
            .select()
            .single();

        if (error) {
            console.error("Failed to update company:", error);
            return NextResponse.json(
                { error: "Failed to update company: " + error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, company: data });
    } catch (err: any) {
        console.error("API Error in /api/company:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
