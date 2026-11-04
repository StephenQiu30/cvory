import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/verify-email", "/reset-password"].map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    }));
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.BACKEND_URL ||
      "http://127.0.0.1:8000";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
