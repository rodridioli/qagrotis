import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/core/auth.config"
import { verifyPassword } from "@/core/db-utils"
import { resolveGoogleAccess, resolveGoogleInternalId } from "@/core/auth-google"
import { photoPathForJwtCookie } from "@/features/usuarios/lib/jwt-photo-path"

/** Dynamic import so /api/auth/session does not load @prisma/client until login flows need the DB. */
async function getPrisma() {
  const { prisma } = await import("@/core/prisma")
  return prisma
}

// Inline credential validation (can't import "use server" actions here)
async function checkCredentials(email: string, password: string) {
  const prisma = await getPrisma()
  const normalizedEmail = email.trim().toLowerCase()

  const createdUser = await prisma.createdUser.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, email: true, password: true },
  })

  if (createdUser) {
    if (!createdUser.password) return null // invite not yet accepted
    if (!verifyPassword(password, createdUser.password)) return null
    // Only query inactiveUser for this specific user — avoids full-table scan
    const inactive = await prisma.inactiveUser.findUnique({ where: { userId: createdUser.id } })
    if (inactive) return null
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
  // Type cast needed: Google() and Credentials() have different internal provider types
  // in next-auth v5, but both satisfy the Provider interface expected by NextAuth() at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(providers as unknown[]).push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
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

        const existingCreated = await prisma.createdUser.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        })

        // Only query inactiveUser for the resolved user — avoids full-table scan
        const inactiveIds = new Set<string>()
        if (existingCreated) {
          const inactive = await prisma.inactiveUser.findUnique({ where: { userId: existingCreated.id } })
          if (inactive) inactiveIds.add(existingCreated.id)
        }
        const decision = resolveGoogleAccess(email, existingCreated, inactiveIds)

        if (!decision.allow) return decision.redirect

        // Auto-registration is disabled: only pre-registered users may sign in.
        // decision.autoRegister is always false after the resolveGoogleAccess refactor.
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
          const createdUsers = await prisma.createdUser.findMany({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
          })
          // Check each candidate individually — avoids full-table scan on inactiveUser
          for (const u of createdUsers) {
            const inactive = await prisma.inactiveUser.findUnique({ where: { userId: u.id } })
            if (!inactive) { activeCreated = u; break }
          }

          if (activeCreated) break
          if (i < 2) await new Promise((r) => setTimeout(r, 100 * (i + 1))) // Backoff
        }

        token.id = resolveGoogleInternalId(email, activeCreated?.id ?? null, user.id ?? "")
        token.email = email
      } else if (user) {
        token.id = user.id
        token.email = user.email
        // Resolve the active CreatedUser id by email (mirrors the Google flow) so that
        // the RBAC enrichment below always has a reliable token.id anchor.
        if (user.email) {
          try {
            const prisma = await getPrisma()
            const normalizedEmail = user.email.trim().toLowerCase()
            const activeCreated = await prisma.createdUser.findFirst({
              where: { email: { equals: normalizedEmail, mode: "insensitive" } },
              select: { id: true },
            })
            if (activeCreated) token.id = activeCreated.id
          } catch {
            // Keep token.id from authorize if DB lookup fails
          }
        }
      }

      // Enriquecer com type + accessProfile (RBAC) e foto do perfil.
      // Não consultar prisma.user aqui: em vários deploys QA o id da sessão é CreatedUser (U-*)
      // e a tabela Auth `User` pode não existir ou não corresponder — gerava 500 no callback.
      if (token.id || token.email) {
        try {
          const { ensureAllUserProfileColumns } = await import("@/core/prisma-schema-ensure")
          await ensureAllUserProfileColumns()
          const prisma = await getPrisma()
          const userId = token.id as string | undefined
          const email = (token.email as string | undefined)?.trim().toLowerCase()

          const [profile, createdById] = await Promise.all([
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
          ])

          let created = createdById
          if (!created && email) {
            const foundByEmail = await prisma.createdUser.findFirst({
              where: { email: { equals: email, mode: "insensitive" } },
              select: { id: true, type: true, accessProfile: true, photoPath: true },
            })
            if (foundByEmail) {
              created = foundByEmail
              // Se token.id era o fallback OAuth (não matchou nenhum createdUser), corrigir agora
              if (!createdById) token.id = foundByEmail.id
            }
          }

          const resolvedType = profile?.type ?? created?.type ?? "Padrão"
          const resolvedProfile = profile?.accessProfile ?? created?.accessProfile ?? "QA"
          token.type = resolvedType === "Administrador" ? "Administrador" : "Padrão"
          token.accessProfile = resolvedProfile as "QA" | "UX" | "TW" | "MGR"
          let mergedPhoto =
            profile?.photoPath ?? created?.photoPath ?? null
          if (
            !mergedPhoto &&
            user &&
            account?.provider === "google" &&
            typeof user.image === "string"
          ) {
            mergedPhoto = user.image
          }
          token.photoPath = photoPathForJwtCookie(mergedPhoto)
        } catch (e) {
          console.error("[auth jwt] enrich token failed", e)
          token.type = token.type ?? "Padrão"
          token.accessProfile = (token.accessProfile as "QA" | "UX" | "TW" | "MGR" | undefined) ?? "QA"
          token.photoPath = null
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      if (session.user) {
        session.user.type = token.type ?? "Padrão"
        session.user.accessProfile =
          (token.accessProfile as "QA" | "UX" | "TW" | "MGR" | undefined) ?? "QA"
        session.user.photoPath = (token.photoPath as string | null | undefined) ?? null
      }
      return session
    },
  },
})
