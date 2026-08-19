"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signInUser, getCurrentUser, getUserCompany } from "../../utils/auth";
import { useAuthStore } from "../../store/useAuthStore";
import { trackMetaEvent } from "@/lib/meta-pixel";

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | null;

interface OrderData {
  status: OrderStatus;
  amount?: number;
  paymentMethod?: string;
  reference?: string;
  createdAt?: string;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function PaymentResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const orderId = searchParams.get("id");
  // Duitku passes these in the returnUrl
  const resultCode = searchParams.get("resultCode");
  const reference = searchParams.get("reference") ?? "";

  const [orderData, setOrderData] = useState<OrderData>({ status: null });
  const [dots, setDots] = useState(".");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const didRedirect = useRef(false);

  // Animated dots for the loading state
  useEffect(() => {
    const d = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(d);
  }, []);

  // Redirect to wall-editor once payment is confirmed PAID
  useEffect(() => {
    if (orderData.status === "PAID" && !didRedirect.current) {
      didRedirect.current = true;

      // Track purchase
      trackMetaEvent("Purchase", {
        currency: "IDR",
        value: orderData.amount || 89999,
        transaction_id: orderId,
      });

      const autoLogin = async () => {
        try {
          const email = sessionStorage.getItem("pendingPaymentEmail");
          const password = sessionStorage.getItem("pendingPaymentPassword");

          if (email && password) {
            // Auto login user
            const authResponse = await signInUser(email, password);
            const userId = authResponse.user?.id;

            if (userId) {
              const userProfile = await getCurrentUser(userId);
              if (userProfile.company_id) {
                const companyInfo = await getUserCompany(
                  userProfile.company_id,
                );
                setSession(userProfile, companyInfo);
              }
            }

            // Clear credentials
            sessionStorage.removeItem("pendingPaymentEmail");
            sessionStorage.removeItem("pendingPaymentPassword");
          }
        } catch (err) {
          console.error("Auto login failed:", err);
        } finally {
          // Small delay so user sees the success flash before redirect
          setTimeout(() => {
            router.push("/wall-editor");
          }, 2000);
        }
      };

      autoLogin();
    }
  }, [orderData.status, router, setSession]);

  useEffect(() => {
    if (!orderId) return;

    async function fetchStatus() {
      // Pass resultCode & reference from Duitku's returnUrl so the server
      // can immediately process the payment without needing transactionStatus
      const params = new URLSearchParams({ id: orderId! });
      if (resultCode) params.set("resultCode", resultCode);
      if (reference) params.set("reference", reference);

      const res = await fetch(`/api/payment/status?${params.toString()}`);
      if (!res.ok) return;
      const data: OrderData = await res.json();
      setOrderData(data);

      // Stop polling once we have a terminal state
      if (
        data.status === "PAID" ||
        data.status === "FAILED" ||
        data.status === "EXPIRED"
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }

    // Immediate fetch on mount
    fetchStatus();

    // Then poll every 3 seconds
    pollRef.current = setInterval(fetchStatus, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, resultCode, reference]);

  // ── UI States ────────────────────────────────────────────────────────────

  if (!orderId) {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 shadow-sm max-w-md w-full text-center border border-[#E8E3FF]">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800">
            Order tidak ditemukan
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            ID order tidak tersedia di URL.
          </p>
          <Link
            href="/home"
            className="mt-6 inline-block bg-[#7B6DED] text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-[#6B5CE7] transition-colors"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  // ─── PAID (brief success flash before redirect) ────────────────────────────
  if (orderData.status === "PAID") {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 shadow-sm max-w-md w-full text-center border border-[#E8E3FF]">
          {/* Success icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#E8F8F0] flex items-center justify-center animate-bounce">
              <svg
                className="w-10 h-10 text-[#22C55E]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-800">
            ✅ Pembayaran Berhasil!
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Menyiapkan akun dan mengalihkan ke halaman wall editor…
          </p>

          <div className="mt-6 bg-[#F7F6FF] rounded-xl p-4 text-left space-y-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Order ID:</span>{" "}
              <span className="font-mono">{orderId}</span>
            </p>
            {orderData.reference && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Reference:</span>{" "}
                <span className="font-mono">{orderData.reference}</span>
              </p>
            )}
            {orderData.amount && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Total Bayar:</span>{" "}
                {formatRupiah(orderData.amount)}
              </p>
            )}
          </div>

          <Link
            href="/wall-editor"
            className="mt-8 inline-block bg-[#7B6DED] text-white px-8 py-3 rounded-full text-sm font-semibold hover:bg-[#6B5CE7] transition-colors shadow-md shadow-[#7B6DED]/30"
          >
            Buka Wall Editor →
          </Link>
        </div>
      </div>
    );
  }

  // ─── PENDING ──────────────────────────────────────────────────────────────
  if (orderData.status === null || orderData.status === "PENDING") {
    return (
      <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 shadow-sm max-w-md w-full text-center border border-[#E8E3FF]">
          {/* Spinner */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-[#E8E3FF] border-t-[#7B6DED] animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">
            Menunggu Konfirmasi{dots}
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Pembayaran sedang diproses. Halaman ini akan otomatis terupdate.
          </p>
          <div className="mt-6 bg-[#F7F6FF] rounded-xl p-4 text-left space-y-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Order ID:</span>{" "}
              <span className="font-mono">{orderId}</span>
            </p>
            {orderData.amount && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Total:</span>{" "}
                {formatRupiah(orderData.amount)}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Mengecek status setiap 3 detik…
          </p>
        </div>
      </div>
    );
  }

  // ─── FAILED / EXPIRED ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 shadow-sm max-w-md w-full text-center border border-[#FFE4E4]">
        {/* Failed icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#FFF0F0] flex items-center justify-center">
            <svg
              className="w-10 h-10 text-[#EF4444]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800">
          {orderData.status === "EXPIRED"
            ? "⏰ Pembayaran Kadaluarsa"
            : "❌ Pembayaran Gagal"}
        </h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          {orderData.status === "EXPIRED"
            ? "Waktu pembayaran sudah habis. Silakan buat order baru untuk melanjutkan."
            : "Pembayaran tidak berhasil diproses. Silakan coba lagi."}
        </p>

        <div className="mt-6 bg-[#FFF8F8] rounded-xl p-4 text-left">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-700">Order ID:</span>{" "}
            <span className="font-mono">{orderId}</span>
          </p>
        </div>

        <Link
          href="/home"
          className="mt-8 inline-block bg-[#7B6DED] text-white px-8 py-3 rounded-full text-sm font-semibold hover:bg-[#6B5CE7] transition-colors"
        >
          Coba Lagi
        </Link>
      </div>
    </div>
  );
}
