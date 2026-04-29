import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/lib/auth.config"
import { verifyPassword, nextId } from "@/lib/db-utils"
import { resolveGoogleAccess, resolveGoogleInternalId } from "@/lib/auth-google"

/** Dynamic import so /api/auth/session does not load @prisma/client until login flows need the DB. */
async function getPrisma() {
  const { prisma } = await import("@/lib/prisma")
  return prisma
}

// Inline credential validation (can't import "use server" actions here)
async function checkCredentials(email: string, password: string) {
  const prisma = await getPrisma()
  const normalizedEmail = email.trim().toLowerCase()

  const [inactiveRecords, createdUser] = await Promise.all([
    prisma.inactiveUser.findMany({ select: { userId: true } }),
    prisma.createdUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true, email: true, password: true },
    }),
  ])

  const inactiveIds = new Set(inactiveRecords.map((r) => r.userId))

  if (createdUser) {
    if (!createdUser.password) return null // invite not yet accepted
    if (!verifyPassword(password, createdUser.password)) return null
    if (inactiveIds.has(createdUser.id)) return null
    return { id: createdUser.id, email: createdUser.email, name: createdUser.email }
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
        const prisma = await getPrisma()
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

        if (decision.autoRegister) {
          if (existingCreated) {
            // @agrotis.com with an existing INACTIVE record: reactivate in a single transaction.
            // Cannot CREATE (email has @unique) — remove from InactiveUser and refresh name.
            await prisma.$transaction([
              prisma.inactiveUser.deleteMany({ where: { userId: existingCreated.id } }),
              prisma.createdUser.update({
                where: { id: existingCreated.id },
                data: { name: user.name ?? email },
              }),
            ])
          } else {
            // @agrotis.com first-time login — no existing record, safe to create.
            const allIds = await prisma.createdUser.findMany({ select: { id: true } })
            const allExistingIds = allIds.map((u) => u.id)
            const id = nextId(allExistingIds, "U")
            await prisma.createdUser.create({
              data: { id, email, name: user.name ?? email, type: "Padrão", password: "" },
            })
          }
          // Note: /configuracoes/usuarios uses force-dynamic, so it always fetches fresh.
          // No revalidatePath needed — it would cause a full layout reload and disable the menu.
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const prisma = await getPrisma()
        // First Google sign-in: resolve internal CreatedUser ID (never trust user.id from OAuth).
        // Use findMany + filter to skip inactive records — an @agrotis.com user may have both
        // an old inactive record and a freshly auto-registered active one for the same email.
        const email = user.email.trim().toLowerCase()

        // Retry logic for DB consistency on first sign-in (give time for commit to be visible)
        let activeCreated = null
        for (let i = 0; i < 3; i++) {
          const [inactiveRecords, createdUsers] = await Promise.all([
            prisma.inactiveUser.findMany({ select: { userId: true } }),
            prisma.createdUser.findMany({
              where: { email: { equals: email, mode: "insensitive" } },
              select: { id: true },
            }),
          ])
          const jwtInactiveIds = new Set(inactiveRecords.map((r) => r.userId))
          activeCreated = createdUsers.find((u) => !jwtInactiveIds.has(u.id))

          if (activeCreated) break
          if (i < 2) await new Promise((r) => setTimeout(r, 100 * (i + 1))) // Backoff
        }

        token.id = resolveGoogleInternalId(email, activeCreated?.id ?? null, user.id ?? "")
      } else if (user) {
        token.id = user.id
      }

      // Enriquecer com type + accessProfile (RBAC) e foto do perfil.
      // Lê em toda chamada para refletir mudanças sem exigir relogin.
      if (token.id || token.email) {
        const prisma = await getPrisma()
        const userId = token.id as string | undefined
        const email = (token.email as string | undefined)?.trim().toLowerCase()

        const [profile, createdById, oauthUser] = await Promise.all([
          userId
            ? prisma.userProfile.findUnique({
                where: { userId },
                select: { type: true, accessProfile: true, photoPath: true },
              })
            : Promise.resolve(null),
          userId
            ? prisma.createdUser.findUnique({
                where: { id: userId },
                select: { type: true, accessProfile: true, photoPath: true },
              })
            : Promise.resolve(null),
          userId
            ? prisma.user.findUnique({ where: { id: userId }, select: { image: true } })
            : Promise.resolve(null),
        ])

        let created = createdById
        if (!created && email) {
          created = await prisma.createdUser.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { type: true, accessProfile: true, photoPath: true },
          })
        }

        const resolvedType = profile?.type ?? created?.type ?? "Padrão"
        const resolvedProfile = profile?.accessProfile ?? created?.accessProfile ?? "QA"
        token.type = resolvedType === "Administrador" ? "Administrador" : "Padrão"
        token.accessProfile = resolvedProfile as "QA" | "UX" | "TW" | "MGR"
        token.photoPath =
          profile?.photoPath ?? created?.photoPath ?? oauthUser?.image ?? null
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      if (session.user) {
        session.user.type = token.type
        session.user.accessProfile = token.accessProfile
        session.user.photoPath = (token.photoPath as string | null | undefined) ?? null
      }
      return session
    },
  },
})
