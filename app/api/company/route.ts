import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { companyId, logoUrl } = body;

        if (!companyId || !logoUrl) {
            return NextResponse.json(
                { error: "Missing required fields: companyId or logoUrl" },
                { status: 400 }
            );
        }

        // Use service role key to bypass RLS for UPDATE
        const { data, error } = await supabaseAdmin
            .from("companies")
            .update({ logo_url: logoUrl })
            .eq("id", companyId)
            .select()
            .single();

        if (error) {
            console.error("Failed to update company logo:", error);
            return NextResponse.json(
                { error: "Failed to update company logo: " + error.message },
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
