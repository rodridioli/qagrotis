/**
 * Security helpers for API routes.
 */
import { NextResponse } from "next/server"
import { env } from "@/lib/env"

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
