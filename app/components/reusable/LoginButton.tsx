"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LoginButton() {
  const pathname = usePathname();

  // Only show on the landing page ("/"), hide on /home and everywhere else
  if (pathname !== "/") return null;

  return (
    <div className="flex items-center">
      <Link
        href="/login"
        className="w-full bg-[#7B6DED] text-white text-[.8rem] md:text-sm font-semibold px-6 py-3 rounded-full hover:bg-[#6a5cd4] transition-colors py-2.5 px-4 rounded-full transition-all text-center active:scale-95"
      >
        Login Sekarang
      </Link>
    </div>
  );
}
