import "./globals.css";
import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Mona_Sans,
  Playfair_Display,
} from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

const playFair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
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
  maximumScale: 1,
  userScalable: false,
  // Also prevent elastic scrolling on iOS
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${monaSans.variable} ${playFair.variable} antialiased`}
      >
        <AuthProvider>
          <GlobalLayout>{children}</GlobalLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
