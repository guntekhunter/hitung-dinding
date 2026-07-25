import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  // resultCode is passed by the result page from Duitku's returnUrl params
  // e.g. ?id=ORD-...&resultCode=00&reference=DS...
  const resultCode = searchParams.get("resultCode");
  const reference = searchParams.get("reference") ?? "";

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // ── 1. Read order from DB ────────────────────────────────────────────────────
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "merchant_order_id, status, amount, payment_method, created_at, reference",
    )
    .eq("merchant_order_id", id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // ── 2. If already in a terminal state, return immediately ──────────────────
  if (
    order.status === "PAID" ||
    order.status === "FAILED" ||
    order.status === "EXPIRED"
  ) {
    return NextResponse.json({
      status: order.status,
      amount: order.amount,
      paymentMethod: order.payment_method,
      reference: order.reference,
      createdAt: order.created_at,
    });
  }

  // ── 3. Duitku returnUrl already told us the result via resultCode param ─────
  //    resultCode=00 → PAID, resultCode=01 → FAILED, resultCode=02 → EXPIRED
  if (resultCode === "00") {
    console.log("[status] resultCode=00 detected in URL, processing payment:", id);

    // Trigger the full callback logic internally (account creation etc.)
    try {
      const merchantCode = process.env.DUITKU_MERCHANT_CODE!;
      const apiKey = process.env.DUITKU_API_KEY!;

      // Build the same MD5 signature the callback verifies
      const callbackSignature = crypto
        .createHash("md5")
        .update(merchantCode + id + String(order.amount) + apiKey)
        .digest("hex");

      const baseUrl =
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_APP_URL!
          : "http://localhost:3000";

      const callbackRes = await fetch(
        `${baseUrl}/api/payment/duitku/callback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantCode,
            merchantOrderId: id,
            amount: String(order.amount),
            signature: callbackSignature,
            resultCode: "00",
            reference,
          }),
        },
      );

      console.log("[status] internal callback response:", callbackRes.status);
    } catch (err) {
      console.error("[status] internal callback failed:", err);
    }

    // Re-read after callback
    const { data: updated } = await supabaseAdmin
      .from("orders")
      .select(
        "merchant_order_id, status, amount, payment_method, created_at, reference",
      )
      .eq("merchant_order_id", id)
      .maybeSingle();

    return NextResponse.json({
      status: updated?.status ?? "PAID",
      amount: updated?.amount ?? order.amount,
      paymentMethod: updated?.payment_method ?? order.payment_method,
      reference: updated?.reference ?? reference,
      createdAt: updated?.created_at ?? order.created_at,
    });
  }

  if (resultCode === "01") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "FAILED" })
      .eq("merchant_order_id", id);
    return NextResponse.json({ status: "FAILED", amount: order.amount });
  }

  if (resultCode === "02") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "EXPIRED" })
      .eq("merchant_order_id", id);
    return NextResponse.json({ status: "EXPIRED", amount: order.amount });
  }

  // ── 4. No resultCode hint — return DB status (still PENDING) ───────────────
  return NextResponse.json({
    status: order.status,
    amount: order.amount,
    paymentMethod: order.payment_method,
    reference: order.reference,
    createdAt: order.created_at,
  });
}
