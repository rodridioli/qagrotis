"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

async function getUserType(email: string): Promise<string | null> {
  const normalized = email.toLowerCase()

  // Check UserProfile overrides (keyed by userId, but email field enables lookup by email)
  const profile = await prisma.userProfile.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { type: true },
  })
  if (profile?.type) return profile.type

  // Check dynamically created users
  const created = await prisma.createdUser.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { type: true },
  })
  if (created) return created.type

  // Fall back to MOCK_USERS constants
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalized)
  return mockUser?.type ?? null
}

/**
 * Asserts the request has a valid session. Throws if not authenticated.
 * Returns the session for further use.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Não autenticado.")
  return session
}

/**
 * Asserts the request has a valid admin session. Throws if not authenticated or not admin.
 */
export async function requireAdmin() {
  const session = await requireSession()
  const email = session.user?.email
  if (!email) throw new Error("Não autorizado.")
  const type = await getUserType(email)
  if (type !== "Administrador") throw new Error("Acesso restrito a administradores.")
  return session
}

/**
 * Returns true if the current session user is an admin, false otherwise.
 * Does not throw — safe to use for UI-only feature flags.
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const session = await auth()
    const email = session?.user?.email
    if (!email) return false
    const type = await getUserType(email)
    return type === "Administrador"
  } catch {
    return false
  }
}
