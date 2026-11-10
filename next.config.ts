import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.CLOUDFLARE_WORKERS_BUILD === "true" ? {} : { output: "standalone" as const }),
  images: { remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }] },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; form-action 'self' https://discord.com; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https://cdn.discordapp.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; upgrade-insecure-requests" }
        ]
      }
    ];
  }
};

export default nextConfig;
