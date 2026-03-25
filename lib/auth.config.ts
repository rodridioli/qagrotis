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
    authorized() {
      // Prototype mode: allow all routes without authentication
      return true
    },
  },
}
