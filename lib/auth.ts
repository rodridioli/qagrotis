import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/lib/auth.config"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { PROTOTYPE_USERS } from "@/lib/prototype-users"
import { verifyPassword, nextId } from "@/lib/db-utils"
import { prisma } from "@/lib/prisma"
import { resolveGoogleAccess, resolveGoogleInternalId } from "@/lib/auth-google"

// Inline credential validation (can't import "use server" actions here)
async function checkCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const [inactiveRecords, createdUser] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.createdUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

  // Check dynamically created users
  if (createdUser) {
    if (!createdUser.password) return null // invite not yet accepted
    if (!verifyPassword(password, createdUser.password)) return null
    if (inactiveIds.has(createdUser.id)) return null
    return { id: createdUser.id, email: createdUser.email, name: createdUser.email }
  }

  // Check MOCK_USERS with PROTOTYPE_USERS passwords
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
  if (mockUser) {
    const expectedPassword = PROTOTYPE_USERS[normalizedEmail] ?? "admin"
    if (password !== expectedPassword) return null
    if (inactiveIds.has(mockUser.id)) return null
    return { id: mockUser.id, email: mockUser.email, name: mockUser.name }
  }

  return null
}

const providers = [
  Credentials({
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      return checkCredentials(
        credentials.email as string,
        credentials.password as string
      )
    },
  }),
]

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }) as never
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = (user.email ?? "").trim().toLowerCase()

        const [existingCreated, inactiveRecords] = await Promise.all([
          prisma.createdUser.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          }),
          prisma.inactiveUser.findMany({ select: { userId: true } }),
        ])

        const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))
        const decision = resolveGoogleAccess(email, existingCreated, inactiveIds)

        if (!decision.allow) return decision.redirect

        // Auto-register @agrotis.com user not yet in any user store
        if (decision.autoRegister) {
          const allIds = await prisma.createdUser.findMany({ select: { id: true } })
          const allExistingIds = [...MOCK_USERS.map((u) => u.id), ...allIds.map((u) => u.id)]
          const id = nextId(allExistingIds, "U")
          await prisma.createdUser.create({
            data: { id, email, name: user.name ?? email, type: "Padrão", password: "" },
          })
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        // First Google sign-in: resolve internal CreatedUser ID (never trust user.id from OAuth).
        // Use findMany + filter to skip inactive records — an @agrotis.com user may have both
        // an old inactive record and a freshly auto-registered active one for the same email.
        const email = user.email.trim().toLowerCase()
        const [inactiveRecords, createdUsers] = await Promise.all([
          prisma.inactiveUser.findMany({ select: { userId: true } }),
          prisma.createdUser.findMany({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          }),
        ])
        const jwtInactiveIds = new Set(inactiveRecords.map((r) => r.userId))
        const activeCreated = createdUsers.find((u) => !jwtInactiveIds.has(u.id))
        token.id = resolveGoogleInternalId(email, activeCreated?.id ?? null, user.id ?? "")
      } else if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
