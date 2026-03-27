import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { productId, newPrice } = body;

        if (!productId || newPrice === undefined || newPrice === null) {
            return NextResponse.json(
                { error: "Missing required fields: productId or newPrice" },
                { status: 400 }
            );
        }

        // Use service role key to bypass RLS for UPDATE
        const { data, error } = await supabaseAdmin
            .from("products")
            .update({ price: newPrice })
            .eq("id", productId)
            .select()
            .single();

        if (error) {
            console.error("Failed to update product price:", error);
            return NextResponse.json(
                { error: "Failed to update product price: " + error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, product: data });
    } catch (err: any) {
        console.error("API Error in /api/product/price:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
