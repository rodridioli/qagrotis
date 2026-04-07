import { MOCK_USERS } from "@/lib/qagrotis-constants"

export type GoogleAccessResult =
  | { allow: true; autoRegister: boolean; internalId?: string }
  | { allow: false; redirect: string }

/**
 * Pure decision function for Google OAuth access.
 * Checks both prisma.createdUser and MOCK_USERS so that seed/prototype
 * users (e.g. rodridioli@gmail.com / U-00) can log in without a DB record.
 */
export function resolveGoogleAccess(
  email: string,
  existingCreated: { id: string } | null,
  inactiveIds: Set<string>
): GoogleAccessResult {
  const isAgroTis = email.endsWith("@agrotis.com")
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === email)

  // Inactive DB user → block for externals; for @agrotis.com create a fresh active account
  if (existingCreated && inactiveIds.has(existingCreated.id)) {
    if (isAgroTis) return { allow: true, autoRegister: true }
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }

  // Inactive mock user (inactive flag tracked via prisma.inactiveUser) → block
  if (mockUser && inactiveIds.has(mockUser.id)) {
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }

  // Unknown externally — not in DB, not a mock user, not @agrotis.com → block
  if (!existingCreated && !mockUser && !isAgroTis) {
    return { allow: false, redirect: "/login?error=UnauthorizedDomain" }
  }

  // @agrotis.com first-time login → auto-register
  if (!existingCreated && !mockUser && isAgroTis) {
    return { allow: true, autoRegister: true }
  }

  // Registered (DB or mock) and active → allow; carry the internal ID
  return {
    allow: true,
    autoRegister: false,
    internalId: existingCreated?.id ?? mockUser?.id,
  }
}

/**
 * Resolves the internal user ID for a Google-authenticated user.
 * Priority: createdUser DB record → MOCK_USERS → fallback to OAuth subject.
 */
export function resolveGoogleInternalId(
  email: string,
  createdId: string | null | undefined,
  fallbackId: string
): string {
  if (createdId) return createdId
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === email)
  return mockUser?.id ?? fallbackId
}
