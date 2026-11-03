import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendMetaCAPIEvent } from "@/lib/meta-capi";

export interface ProcessOrderResult {
  success: boolean;
  message: string;
  userId?: string;
  alreadyProcessed?: boolean;
}

/**
 * Shared helper to complete an order, create company & user in Supabase,
 * dispatch password reset email, activate subscription, and fire Meta CAPI.
 * Safe to be called from both Duitku Callback and /api/payment/status.
 */
export async function processPaidOrder(
  merchantOrderId: string,
  reference?: string | null,
  amount?: number | string
): Promise<ProcessOrderResult> {
  // 1. Fetch order
  const { data: order, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, amount")
    .eq("merchant_order_id", merchantOrderId)
    .maybeSingle();

  if (fetchError || !order) {
    console.error("[processPaidOrder] Order not found:", merchantOrderId);
    return { success: false, message: "Order not found" };
  }

  // Idempotency: if already paid, return early
  if (order.status === "PAID") {
    return { success: true, message: "Order already processed", alreadyProcessed: true, userId: order.user_id };
  }

  // 2. Fetch pending registration
  const { data: pending, error: pendingFetchError } = await supabaseAdmin
    .from("pending_registrations")
    .select("*")
    .eq("merchant_order_id", merchantOrderId)
    .maybeSingle();

  if (pendingFetchError || !pending) {
    console.error("[processPaidOrder] pending_registration not found for:", merchantOrderId);
    // Mark order PAID anyway so we don't block
    await supabaseAdmin
      .from("orders")
      .update({ status: "PAID", reference: reference ?? null })
      .eq("merchant_order_id", merchantOrderId);
    return { success: false, message: "Pending registration not found" };
  }

  // 3. Generate Temporary Password
  const temporaryPassword =
    "Rapi@" + crypto.randomBytes(4).toString("hex") + Math.floor(10 + Math.random() * 90);

  // 4. Create Supabase Auth User
  let newUserId: string;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: pending.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      name: pending.admin_name,
      must_change_password: true,
      temporary_password: temporaryPassword,
    },
  });

  if (authError || !authData.user) {
    console.warn("[processPaidOrder] createUser note/error:", authError?.message);
    // If user already exists in auth (e.g. registered previously), find existing user
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = userList?.users?.find(
      (u) => u.email?.toLowerCase() === pending.email.toLowerCase()
    );
    if (existing) {
      newUserId = existing.id;
    } else {
      console.error("[processPaidOrder] Failed to create or find auth user:", authError);
      await supabaseAdmin
        .from("orders")
        .update({ status: "PAID", reference: reference ?? null })
        .eq("merchant_order_id", merchantOrderId);
      return { success: false, message: authError?.message || "Auth error" };
    }
  } else {
    newUserId = authData.user.id;
  }

  // 5. Send Password Email via Supabase
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")
      ? process.env.NEXT_PUBLIC_APP_URL
      : "https://rapistudio.com";

  try {
    const { error: resetEmailError } = await supabaseAdmin.auth.resetPasswordForEmail(
      pending.email,
      {
        redirectTo: `${appUrl}/update-password`,
      }
    );

    if (resetEmailError) {
      console.warn("[processPaidOrder] resetPasswordForEmail warning:", resetEmailError);
    } else {
      console.log(`[processPaidOrder] Supabase password email dispatched to ${pending.email}`);
    }
  } catch (emailErr) {
    console.warn("[processPaidOrder] email notification error:", emailErr);
  }

  // 6. Create Company if not exists
  let companyId: string;
  const { data: newCompany, error: companyError } = await supabaseAdmin
    .from("companies")
    .insert([{ name: pending.company_name || "Perusahaan Saya" }])
    .select()
    .single();

  if (companyError || !newCompany) {
    console.error("[processPaidOrder] company insert error:", companyError);
    // Check if user already has a company in profile
    const { data: existingProf } = await supabaseAdmin
      .from("users")
      .select("company_id")
      .eq("id", newUserId)
      .maybeSingle();

    if (existingProf?.company_id) {
      companyId = existingProf.company_id;
    } else {
      return { success: false, message: "Company creation failed" };
    }
  } else {
    companyId = newCompany.id;
  }

  // 7. Upsert User Profile
  const { error: profileError } = await supabaseAdmin.from("users").upsert(
    [
      {
        id: newUserId,
        company_id: companyId,
        name: pending.admin_name,
        role: "admin",
        wa_number: pending.wa_number,
        must_change_password: true,
      },
    ],
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("[processPaidOrder] user profile upsert error:", profileError);
  }

  // 8. Update Order -> PAID
  await supabaseAdmin
    .from("orders")
    .update({
      status: "PAID",
      reference: reference ?? null,
      user_id: newUserId,
    })
    .eq("merchant_order_id", merchantOrderId);

  // 9. Activate Subscription
  const planMonths: number =
    typeof pending.plan_months === "number" && pending.plan_months > 0
      ? pending.plan_months
      : 3;

  const expiredAt = new Date();
  expiredAt.setMonth(expiredAt.getMonth() + planMonths);

  const { error: subError } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: newUserId,
      plan: "PRO",
      expired_at: expiredAt.toISOString(),
      order_id: merchantOrderId,
    },
    { onConflict: "user_id" }
  );

  if (subError) {
    console.error("[processPaidOrder] subscription upsert error:", subError);
  }

  // 10. Delete Pending Registration
  await supabaseAdmin
    .from("pending_registrations")
    .delete()
    .eq("merchant_order_id", merchantOrderId);

  // 11. Send Meta CAPI Purchase Event
  const orderAmount =
    amount !== undefined
      ? parseInt(String(amount), 10)
      : order.amount || (planMonths === 1 ? 89999 : 150000);

  await sendMetaCAPIEvent(
    "Purchase",
    {
      email: pending.email,
      phone: pending.wa_number,
      firstName: pending.admin_name,
    },
    {
      currency: "IDR",
      value: orderAmount,
    },
    merchantOrderId
  );

  console.log(
    `[processPaidOrder] ✅ Account + subscription (${planMonths}mo) completed for ${pending.email}, order ${merchantOrderId}`
  );

  return { success: true, message: "Order processed successfully", userId: newUserId };
}
