"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";

type Step = "form" | "processing";

interface FormData {
  companyName: string;
  adminName: string;
  email: string;
  waNumber: string;
  password: string;
}

export default function PaymentPage() {
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormData>({
    companyName: "",
    adminName: "",
    email: "",
    waNumber: "",
    password: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic WA validation
    if (!/^08|^\+62/.test(form.waNumber)) {
      setError("Nomor WhatsApp harus diawali 08 atau +62");
      return;
    }
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setStep("processing");

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          adminName: form.adminName,
          email: form.email,
          waNumber: form.waNumber,
          password: form.password,
          paymentMethod: "QR",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal membuat pembayaran. Coba lagi.");
        setStep("form");
        return;
      }

      // Redirect to Duitku payment page
      window.location.href = data.paymentUrl;
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
      setStep("form");
    }
  }

  const inputClass =
    "w-full px-4 py-3 bg-[#F8F7FF] border border-[#E8E3FF] text-gray-800 text-sm rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7B6DED]/30 focus:border-[#7B6DED] transition-all";
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide";

  return (
    <div className="bg-white flex flex-col font-mona-sans tracking-tight">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[#E8E3FF] bg-white/80 backdrop-blur-sm">
        <Link href="/home">
          <Image src="/logo.svg" alt="Rapi Studio" width={160} height={48} className="h-8 w-auto" />
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Progress indicator */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${step === "form" ? "bg-[#7B6DED] text-white" : "bg-[#22C55E] text-white"}`}>
              {step === "form" ? "1" : "✓"}
            </div>
            <div className="flex-1 h-0.5 bg-[#E8E3FF]">
              <div className={`h-full bg-[#7B6DED] transition-all duration-500 ${step === "processing" ? "w-full" : "w-0"}`} />
            </div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${step === "processing" ? "bg-[#7B6DED] text-white" : "bg-[#E8E3FF] text-[#9C8EF0]"}`}>
              2
            </div>
            <div className="flex-1 h-0.5 bg-[#E8E3FF]" />
            <div className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold bg-[#E8E3FF] text-[#9C8EF0]">
              3
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-8 px-1">
            <span>Data Akun</span>
            <span>Pembayaran</span>
            <span>Selesai</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl  border border-[#E8E3FF] overflow-hidden">

            {/* Card header */}
            <div className="bg-[#7B6DED] px-8 py-6 text-white">
              <h1 className="text-2xl font-bold">Buat Akun & Bayar</h1>
              <p className="text-sm opacity-80 mt-1">
                Isi data di bawah, lalu selesaikan pembayaran Rp 89.999 anda.
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-8">
              {step === "processing" ? (
                /* Processing state */
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-14 h-14 rounded-full border-4 border-[#E8E3FF] border-t-[#7B6DED] animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Menghubungkan ke Duitku…</p>
                  <p className="text-xs text-gray-400">Kamu akan segera diarahkan ke halaman pembayaran.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Error */}
                  {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2 items-start">
                      <span className="text-rose-500 text-sm mt-0.5">⚠️</span>
                      <p className="text-sm text-rose-700 font-medium leading-snug">{error}</p>
                    </div>
                  )}

                  {/* Company section */}
                  <div>
                    <div>
                      <label className={labelClass}>Nama Perusahaan / Toko</label>
                      <input
                        required
                        name="companyName"
                        className={inputClass}
                        placeholder="Contoh: Toko WPC Jaya"
                        value={form.companyName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="border-t border-[#F0EEFF] pt-5">
                    <div className="space-y-4">

                      {/* Admin name */}
                      <div>
                        <label className={labelClass}>Nama Lengkap</label>
                        <input
                          required
                          name="adminName"
                          className={inputClass}
                          placeholder="Nama kamu"
                          value={form.adminName}
                          onChange={handleChange}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className={labelClass}>Email</label>
                        <input
                          required
                          type="email"
                          name="email"
                          inputMode="email"
                          autoComplete="email"
                          className={inputClass}
                          placeholder="email@contoh.com"
                          value={form.email}
                          onChange={handleChange}
                        />
                        <p className="text-[11px] text-gray-400 mt-1">
                          Digunakan untuk login ke Rapi Studio
                        </p>
                      </div>

                      {/* WhatsApp */}
                      <div>
                        <label className={labelClass}>Nomor WhatsApp</label>
                        <div className="relative">
                          <input
                            required
                            type="tel"
                            name="waNumber"
                            inputMode="tel"
                            className={inputClass + ""}
                            placeholder="08xxxxxxxxxx"
                            value={form.waNumber}
                            onChange={handleChange}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Untuk konfirmasi & onboarding
                        </p>
                      </div>

                      {/* Password */}
                      <div>
                        <label className={labelClass}>Password</label>
                        <div className="relative">
                          <input
                            required
                            type={showPassword ? "text" : "password"}
                            name="password"
                            minLength={6}
                            autoComplete="new-password"
                            className={inputClass + " pr-12"}
                            placeholder="Min. 6 karakter"
                            value={form.password}
                            onChange={handleChange}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((p) => !p)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1"
                          >
                            {showPassword ? "Sembunyikan" : "Lihat"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price summary */}
                  <div className="bg-[#F7F6FF] rounded-xl p-4 flex items-center justify-between mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Total Pembayaran</p>
                      <p className="text-xl font-bold text-gray-800">Rp 89.999</p>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-[#7B6DED] hover:bg-[#6B5CE7] text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm"
                  >
                    Lanjut ke Pembayaran →
                  </button>

                  <p className="text-[11px] text-center text-gray-400 leading-relaxed">
                    Dengan melanjutkan, kamu menyetujui syarat & ketentuan Rapi Studio.
                    Akun akan dibuat otomatis setelah pembayaran berhasil.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Guarantees */}
          <div className="flex justify-center gap-8 mt-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#ECE9FF] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#7B6DED]" />
              </div>

              <div>
                <p className="text-sm font-medium">Garansi</p>
                <p className="text-xs text-gray-500">Uang Kembali</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#ECE9FF] flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-[#7B6DED]" />
              </div>

              <div>
                <p className="text-sm font-medium">Jaminan</p>
                <p className="text-xs text-gray-500">Kepuasan</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
