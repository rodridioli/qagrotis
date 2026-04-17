import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config — NO database/pg imports here
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login?error=1",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = request.nextUrl
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/definir-senha") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/stripe") ||
        pathname.startsWith("/api/test-mail")
      if (isPublic) return true
      return isLoggedIn
    },
  },
}
