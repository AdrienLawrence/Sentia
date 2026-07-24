import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseConnectSources = (() => {
  if (!supabaseUrl) return [];

  try {
    const url = new URL(supabaseUrl);
    const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";

    return [url.origin, `${websocketProtocol}//${url.host}`];
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseConnectSources.join(" ")}${isProduction ? "" : " http://localhost:* ws://localhost:*"}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isProduction ? "upgrade-insecure-requests" : ""
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin"
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload"
        }
      ]
    : [])
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
