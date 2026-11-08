import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // The deck routes set their own strict CSP; vinext lets config headers override handler headers.
        // Pages get a per-request nonce CSP from src/proxy.ts, which vinext prefers over this one, so
        // this policy only covers what the proxy leaves alone (API/upload responses, redirects) and
        // needs no inline script.
        source: "/((?!api/report/presentation$|api/presentation/brand/preview$).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Dev (vite + React dev mode) requires 'unsafe-eval' for callstack
              // reconstruction; production stays strict.
              isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'",
              // Google Fonts: the brand preview iframe (srcdoc) inherits this policy and
              // loads the brand's chosen fonts, same origins the exported deck allows.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              // Dev only: vite's HMR websocket.
              isDev ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*" : "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
