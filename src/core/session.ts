"use server"

import { auth } from "@/core/auth"

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
 * Uses the type stored in the JWT (set at login and refreshed on each request) to avoid
 * an extra DB round-trip on every admin-guarded action.
 */
export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.type !== "Administrador") throw new Error("Acesso restrito a administradores.")
  return session
}

/**
 * Returns true if the current session user is an admin, false otherwise.
 * Does not throw — safe to use for UI-only feature flags.
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const session = await auth()
    return session?.user?.type === "Administrador"
  } catch {
    return false
  }
}
