import type { NextConfig } from "next";
import path from "path";

/** Vercel rejects rewrites to loopback with DNS_HOSTNAME_RESOLVED_PRIVATE. */
function loopback(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
  } catch {
    return true;
  }
}

function apiOrigin() {
  const configured = process.env.API_URL?.replace(/\/$/, "");
  if (process.env.VERCEL && (!configured || loopback(configured))) return null;
  return configured || "http://localhost:3001";
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    const origin = apiOrigin();
    if (!origin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
