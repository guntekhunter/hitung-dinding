import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  images: {
    // Use AVIF first (better compression), then WebP as fallback
    formats: ["image/avif", "image/webp"],
    // Tighter device sizes for mobile-first optimization
    deviceSizes: [360, 414, 768, 1080, 1280, 1920],
    imageSizes: [64, 128, 256, 384],
    // Cache optimized images for 1 year
    minimumCacheTTL: 31536000,
  },
  // Compress static assets
  compress: true,
};

const wrappedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default wrappedConfig;
