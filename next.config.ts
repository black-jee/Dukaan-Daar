import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For Cloudflare Pages compatibility (use with @cloudflare/next-on-pages or OpenNext)
  images: {
    unoptimized: true,
  },
  // Experimental features if needed
  experimental: {
    // serverActions: true is default in Next 15
  },
};

export default nextConfig;
