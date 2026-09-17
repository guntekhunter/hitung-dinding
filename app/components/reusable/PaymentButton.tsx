"use client";

import Link from "next/link";

interface PaymentButtonProps {
  children?: React.ReactNode;
  className?: string;
  href?: string;
}

/**
 * PaymentButton — redirects user to the /payment registration+payment page.
 * Pass `href` to include a plan query param, e.g. /payment?plan=1month.
 */
export default function PaymentButton({
  children = "Dapatkan Akses Sekarang",
  className = "",
  href = "/payment",
}: PaymentButtonProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center justify-center gap-2 bg-[#7B6DED] hover:bg-[#6B5CE7] text-white font-semibold py-3 px-6 rounded-full transition-all duration-200 shadow-md shadow-[#7B6DED]/25 ${className}`}
    >
      {children}
    </Link>
  );
}
