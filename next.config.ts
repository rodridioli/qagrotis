import type { NextConfig } from "next";

const securityHeaders = [
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
    // TODO(security/B1): existem erros TS pré-existentes (CenariosClient, ClientesClient,
    // suites, usuarios, stories) — corrigir e mudar para `false`.
    ignoreBuildErrors: true,
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
