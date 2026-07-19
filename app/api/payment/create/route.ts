import { NextResponse } from "next/server";
import { createSignature } from "@/lib/duitku";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DUITKU_BASE_URL =
  process.env.DUITKU_BASE_URL ?? "https://passport.duitku.com/webapi/api/merchant";
const PLAN_PRICE = 89999; // Rp 89.999

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── Pre-registration flow (from /payment page) ───────────────────────────
    const {
      companyName,
      adminName,
      email,
      waNumber,
      password,
      paymentMethod,
    } = body;

    if (!companyName || !adminName || !email || !waNumber || !password) {
      return NextResponse.json(
        { error: "Semua field wajib diisi." },
        { status: 400 },
      );
    }

    // ── 1. Cek apakah email sudah terdaftar di Supabase Auth ─────────────────
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailTaken = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (emailTaken) {
      return NextResponse.json(
        { error: "Email sudah terdaftar. Silakan login atau gunakan email lain." },
        { status: 409 },
      );
    }

    // ── 2. Generate Order ID unik ────────────────────────────────────────────
    const timestamp = Date.now();
    const slugEmail = email.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
    const merchantOrderId = `ORD-${slugEmail}-${timestamp}`;

    const merchantCode = process.env.DUITKU_MERCHANT_CODE!;
    const apiKey = process.env.DUITKU_API_KEY!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    const signature = createSignature(
      merchantCode,
      merchantOrderId,
      PLAN_PRICE,
      apiKey,
    );

    // ── 3. Simpan pending registration (data akun sementara) ─────────────────
    const { error: pendingError } = await supabaseAdmin
      .from("pending_registrations")
      .insert({
        merchant_order_id: merchantOrderId,
        company_name: companyName,
        admin_name: adminName,
        email: email.toLowerCase(),
        wa_number: waNumber,
        password_plain: password, // akan dihapus setelah akun dibuat
      });

    if (pendingError) {
      console.error("[create] pending_registrations insert error:", pendingError);
      return NextResponse.json(
        { error: "Gagal menyimpan data. Coba lagi." },
        { status: 500 },
      );
    }

    // ── 4. Simpan order ke Supabase (PENDING, user_id null dulu) ─────────────
    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      merchant_order_id: merchantOrderId,
      user_id: null, // akan diisi setelah akun dibuat di callback
      amount: PLAN_PRICE,
      status: "PENDING",
      payment_method: paymentMethod ?? "QR",
    });

    if (insertError) {
      console.error("[create] insert order error:", insertError);
      return NextResponse.json(
        { error: "Gagal menyimpan order." },
        { status: 500 },
      );
    }

    // ── 5. Request ke Duitku ─────────────────────────────────────────────────
    const duitkuPayload = {
      merchantCode,
      paymentAmount: PLAN_PRICE,
      paymentMethod: paymentMethod ?? "QR",
      merchantOrderId,
      productDetails: "Rapi Studio PRO — Akses 1 Bulan",
      customerVaName: adminName,
      email: email.toLowerCase(),
      phoneNumber: waNumber,
      additionalParam: "",
      merchantUserInfo: merchantOrderId, // pakai order ID sebagai referensi
      customerDetail: {
        firstName: adminName,
        lastName: "",
        email: email.toLowerCase(),
        phoneNumber: waNumber,
      },
      callbackUrl: `${appUrl}/api/payment/duitku/callback`,
      returnUrl: `${appUrl}/payment/result?id=${merchantOrderId}`,
      signature,
      expiryPeriod: 1440, // 24 jam
    };

    const duitkuRes = await fetch(`${DUITKU_BASE_URL}/v2/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(duitkuPayload),
    });

    const duitkuData = await duitkuRes.json();

    if (!duitkuRes.ok || !duitkuData.paymentUrl) {
      console.error("[create] duitku error:", duitkuData);
      await supabaseAdmin
        .from("orders")
        .update({ status: "FAILED" })
        .eq("merchant_order_id", merchantOrderId);

      return NextResponse.json(
        { error: duitkuData.Message ?? "Gagal membuat pembayaran di Duitku." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      paymentUrl: duitkuData.paymentUrl,
      merchantOrderId,
      reference: duitkuData.reference ?? null,
    });
  } catch (err) {
    console.error("[create] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
