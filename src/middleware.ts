import NextAuth from "next-auth"
import { authConfig } from "@/core/auth.config"

// Edge-compatible middleware — uses authConfig (no Prisma/pg imports).
// The `authorized` callback in authConfig redirects unauthenticated users to /login.
export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    // Run on all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
}
