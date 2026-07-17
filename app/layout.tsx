import "./globals.css";
import type { Metadata } from "next";
import { Mona_Sans, Playfair_Display } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";

// Only load the two fonts actually used — drops 2 unnecessary font network requests
const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  display: "swap",
});

const playFair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rapi Studio",
  description:
    "Hemat waktu dan Jutaan rupiah dengan desain interior PVC yang lebih mudah & cepat, dibanding bayar interior desainer",
};

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Removed maximumScale:1 / userScalable:false — Lighthouse accessibility penalty
  themeColor: "#ffffff",
};

import AuthProvider from "./components/AuthProvider";
import GlobalLayout from "./components/GlobalLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${monaSans.variable} ${playFair.variable} antialiased`}
      >
        <AuthProvider>
          <GlobalLayout>{children}</GlobalLayout>
        </AuthProvider>
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
    </html>
  );
}
