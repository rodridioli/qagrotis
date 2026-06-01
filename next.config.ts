import type { NextConfig } from "next";

// Content-Security-Policy
// Notes:
// - 'unsafe-inline' for scripts is required by Next.js App Router (inline hydration scripts).
//   Upgrade to nonce-based CSP once Next.js nonce support is enabled in middleware.
// - 'unsafe-inline' for styles is required by Tailwind CSS (generated inline styles).
// - Stripe JS is loaded client-side for billing; stripe.com frames are needed for 3DS.
// - lh3.googleusercontent.com and avatars.githubusercontent.com serve user profile photos.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://cdn.discordapp.com https://secure.gravatar.com https://avatar-management--avatars.us-west-2.prod.atl-paas.net https://*.atlassian.net https://*.atlassian.com",
  "font-src 'self'",
  "connect-src 'self' https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ")

const securityHeaders = [
  // Content Security Policy — primary XSS defense
  { key: "Content-Security-Policy", value: csp },
  // Prevents clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stops browsers from sniffing MIME types
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send referrer on same origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Basic XSS protection for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Enforce HTTPS for 2 years, including subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
]

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/atualizacoes/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
