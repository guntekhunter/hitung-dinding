import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    // Duitku sends either JSON or form-urlencoded
    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, string>;

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text).entries());
    }

    const { merchantCode, merchantOrderId, amount, signature, resultCode, reference } =
      body;

    // ── 1. Verifikasi Signature ──────────────────────────────────────────────
    const localSignature = crypto
      .createHash("md5")
      .update(
        merchantCode + merchantOrderId + amount + process.env.DUITKU_API_KEY,
      )
      .digest("hex");

    if (localSignature !== signature) {
      console.warn("[callback] invalid signature:", merchantOrderId);
      return NextResponse.json({ message: "Invalid Signature" }, { status: 401 });
    }

    // ── 2. Ambil order ───────────────────────────────────────────────────────
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, amount")
      .eq("merchant_order_id", merchantOrderId)
      .maybeSingle();

    if (fetchError || !order) {
      console.error("[callback] order not found:", merchantOrderId);
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Idempotency — already processed
    if (order.status === "PAID") {
      return NextResponse.json({ statusCode: "00", statusMessage: "SUCCESS (already processed)" });
    }

    // ── 3. Proses pembayaran ─────────────────────────────────────────────────
    if (resultCode === "00") {

      // ── 3a. Ambil data registrasi pending ──────────────────────────────────
      const { data: pending, error: pendingFetchError } = await supabaseAdmin
        .from("pending_registrations")
        .select("*")
        .eq("merchant_order_id", merchantOrderId)
        .maybeSingle();

      if (pendingFetchError || !pending) {
        console.error("[callback] pending_registration not found:", merchantOrderId);
        // Jangan blok callback Duitku — tandai order dan lanjut
        await supabaseAdmin
          .from("orders")
          .update({ status: "PAID", reference: reference ?? null })
          .eq("merchant_order_id", merchantOrderId);
        return NextResponse.json({ statusCode: "00", statusMessage: "SUCCESS" });
      }

      // ── 3b. Buat Supabase Auth user ────────────────────────────────────────
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: pending.email,
          password: pending.password_plain,
          email_confirm: true, // bypass email confirmation
        });

      if (authError || !authData.user) {
        console.error("[callback] createUser error:", authError);
        // If email already exists (race condition), try to fetch existing user
        // We still mark order paid
        await supabaseAdmin
          .from("orders")
          .update({ status: "PAID", reference: reference ?? null })
          .eq("merchant_order_id", merchantOrderId);
        return NextResponse.json({ statusCode: "00", statusMessage: "SUCCESS" });
      }

      const newUserId = authData.user.id;

      // ── 3c. Buat Company ───────────────────────────────────────────────────
      const { data: newCompany, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert([{ name: pending.company_name }])
        .select()
        .single();

      if (companyError || !newCompany) {
        console.error("[callback] company insert error:", companyError);
        // Rollback auth user
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        await supabaseAdmin
          .from("orders")
          .update({ status: "FAILED" })
          .eq("merchant_order_id", merchantOrderId);
        return NextResponse.json({ statusCode: "00", statusMessage: "SUCCESS" });
      }

      // ── 3d. Buat User Profile ──────────────────────────────────────────────
      const { error: profileError } = await supabaseAdmin.from("users").insert([
        {
          id: newUserId,
          company_id: newCompany.id,
          name: pending.admin_name,
          role: "admin",
          wa_number: pending.wa_number,
        },
      ]);

      if (profileError) {
        console.error("[callback] user profile insert error:", profileError);
        // Rollback
        await supabaseAdmin.from("companies").delete().eq("id", newCompany.id);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        await supabaseAdmin
          .from("orders")
          .update({ status: "FAILED" })
          .eq("merchant_order_id", merchantOrderId);
        return NextResponse.json({ statusCode: "00", statusMessage: "SUCCESS" });
      }

      // ── 3e. Update order → PAID + user_id ────────────────────────────────
      await supabaseAdmin
        .from("orders")
        .update({
          status: "PAID",
          reference: reference ?? null,
          user_id: newUserId,
        })
        .eq("merchant_order_id", merchantOrderId);

      // ── 3f. Aktifkan Subscription (1 tahun) ───────────────────────────────
      const expiredAt = new Date();
      expiredAt.setFullYear(expiredAt.getFullYear() + 1);

      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: newUserId,
            plan: "PRO",
            expired_at: expiredAt.toISOString(),
            order_id: merchantOrderId,
          },
          { onConflict: "user_id" },
        );

      if (subError) {
        console.error("[callback] subscription upsert error:", subError);
        // Non-fatal: account created, order paid. Bisa di-fix manual.
      }

      // ── 3g. Hapus data pending (cleanup) ──────────────────────────────────
      await supabaseAdmin
        .from("pending_registrations")
        .delete()
        .eq("merchant_order_id", merchantOrderId);

      console.log(
        `[callback] ✅ Account + subscription created for ${pending.email}, order ${merchantOrderId}`,
      );

    } else {
      // Pembayaran gagal / expired
      const failStatus = resultCode === "02" ? "EXPIRED" : "FAILED";

      await supabaseAdmin
        .from("orders")
        .update({ status: failStatus })
        .eq("merchant_order_id", merchantOrderId);

      console.log(
        `[callback] ❌ Order ${merchantOrderId} → ${failStatus} (resultCode: ${resultCode})`,
      );
    }

    // Duitku expects this exact response to stop retrying
    return NextResponse.json({
      statusCode: "00",
      statusMessage: "SUCCESS",
    });
  } catch (err) {
    console.error("[callback] unexpected error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
