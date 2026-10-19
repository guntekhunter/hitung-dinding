import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // 1. Update users table must_change_password flag
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ must_change_password: false })
      .eq("id", userId);

    if (userError) {
      console.error("[clear-password-flag] user update error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // 2. Also remove/update must_change_password from Supabase auth user_metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { must_change_password: false },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[clear-password-flag] error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
