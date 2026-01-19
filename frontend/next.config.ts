import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // API rewrites only work in local development
  // In production on Cloudflare, we call the backend directly using NEXT_PUBLIC_BACKEND_URL
  async rewrites() {
    // Only apply rewrites in development
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8787/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
