import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = ["/login", "/definir-senha", "/api/auth", "/api/stripe", "/api/test-mail"]

// NextAuth v5 (Auth.js v5) changed cookie names from "next-auth.*" to "authjs.*"
// In production (HTTPS) the cookie has the "__Secure-" prefix.
const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: SESSION_COOKIE,
  })

  if (!token) {
    const loginUrl = new URL("/login", request.nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
