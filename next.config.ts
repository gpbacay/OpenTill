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
  // The Nest API runs inside pages/api: load these from node_modules at runtime instead of bundling them.
  serverExternalPackages: [
    "@nestjs/common",
    "@nestjs/core",
    "@nestjs/platform-express",
    "express",
    "reflect-metadata",
    "@prisma/client",
    "@prisma/adapter-libsql",
    "@libsql/client",
  ],
  outputFileTracingIncludes: { "/api/**": ["./node_modules/.prisma/client/**"] },
  async rewrites() {
    const origin = apiOrigin();
    // Without an API origin (Vercel) /api/* is served by pages/api inside this app.
    if (!origin) return [];
    return {
      // beforeFiles so the proxy wins over pages/api when a separate API is configured (npm run dev).
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${origin}/api/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
