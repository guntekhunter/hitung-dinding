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
import Script from "next/script";

const META_PIXEL_ID = process.env.PIXEL_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${monaSans.variable} ${playFair.variable} antialiased`}>
        <AuthProvider>
          <GlobalLayout>{children}</GlobalLayout>
        </AuthProvider>
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');

              fbq('init', '${META_PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
      </body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
    </html>
  );
}
