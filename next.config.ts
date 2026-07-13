import type { NextConfig } from "next";
import path from "path";

const apiOrigin =
  process.env.API_URL?.replace(/\/$/, "") || "http://localhost:3001";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
