import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { processPaidOrder } from "@/lib/payment-service";

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
      await processPaidOrder(merchantOrderId, reference, amount);
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
