import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Exact public paths (no auth required)
const PUBLIC_PATHS = new Set(["/", "/login", "/pricing"])

// Public path prefixes (and all sub-paths)
const PUBLIC_PREFIXES = ["/api/auth"]

// Protected path prefixes (auth required)
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/billing"]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export default auth((req: NextRequest & { auth: unknown }) => {
  const { nextUrl } = req
  const session = (req as NextRequest & { auth: { user?: { id: string } } | null }).auth
  const isLoggedIn = !!session?.user?.id
  const { pathname } = nextUrl

  // Redirect unauthenticated users from protected routes
  if (isProtected(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
