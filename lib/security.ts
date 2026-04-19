/**
 * Security helpers for API routes.
 */
import { NextResponse } from "next/server"
import { env } from "@/lib/env"

// Private/internal IP ranges that must never be reached via SSRF
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"])
// Exact-prefix checks for unambiguous private ranges
const BLOCKED_PREFIXES = ["10.", "192.168.", "127.", "169.254.", "fc", "fd"]

function isPrivateIp(host: string): boolean {
  if (BLOCKED_HOSTNAMES.has(host)) return true
  if (BLOCKED_PREFIXES.some((p) => host.startsWith(p))) return true
  // RFC 1918: 172.16.0.0/12 — only octets 16–31 are private
  const m = host.match(/^172\.(\d{1,3})\./)
  if (m) {
    const octet = parseInt(m[1], 10)
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

/**
 * Validate that a URL is safe to proxy to externally.
 * Blocks localhost, private IP ranges and non-HTTPS schemes (SSRF prevention).
 */
export function isSafeExternalUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:") return false
  return !isPrivateIp(parsed.hostname.toLowerCase())
}

/**
 * Validate that a returnUrl belongs to the same origin as the app.
 * Prevents open redirect attacks.
 */
export function isSameOriginUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin
    return parsed.origin === appOrigin
  } catch {
    return false
  }
}

/**
 * Validate that the request Origin header matches the app's origin.
 * Prevents CSRF attacks on state-changing endpoints.
 * Returns a 403 response if the origin is invalid, otherwise null.
 */
export function validateOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin")
  // Same-origin requests from Next.js SSR won't have an Origin header
  if (!origin) return null

  try {
    const requestOrigin = new URL(origin).origin
    const appOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin
    if (requestOrigin !== appOrigin) {
      return NextResponse.json(
        { error: "Forbidden: invalid origin" },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: "Forbidden: malformed origin" },
      { status: 403 }
    )
  }

  return null
}
