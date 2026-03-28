"use server"

import { auth } from "@/lib/auth"
import { promises as fs } from "fs"
import path from "path"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

const DATA_DIR = path.join(process.cwd(), "data")

async function getUserType(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase()

  // Check profiles (overrides)
  try {
    const profilesRaw = await fs.readFile(path.join(DATA_DIR, "user-profiles.json"), "utf-8")
    const profiles = JSON.parse(profilesRaw) as Record<string, { email?: string; type?: string }>
    const profileEntry = Object.values(profiles).find(
      (p) => p.email?.toLowerCase() === normalizedEmail
    )
    if (profileEntry?.type) return profileEntry.type
  } catch { /* ignore */ }

  // Check created users
  try {
    const createdRaw = await fs.readFile(path.join(DATA_DIR, "created-users.json"), "utf-8")
    const created = JSON.parse(createdRaw) as Array<{ email: string; type: string }>
    const found = created.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (found) return found.type
  } catch { /* ignore */ }

  // Fall back to MOCK_USERS
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
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
