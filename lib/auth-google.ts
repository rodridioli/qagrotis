import { MOCK_USERS } from "@/lib/qagrotis-constants"

export type GoogleAccessResult =
  | { allow: true; autoRegister: boolean; internalId?: string }
  | { allow: false; redirect: string }

/**
 * Access rules for Google OAuth login:
 *
 * 1. @agrotis.com → always allowed; auto-registered as "Padrão" if first login
 * 2. Other domains → only allowed if an admin pre-registered the email in createdUser
 *    (or if it's a MOCK_USER like the master admin account)
 * 3. Inactive users → always blocked
 */
export function resolveGoogleAccess(
  email: string,
  existingCreated: { id: string } | null,
  inactiveIds: Set<string>
): GoogleAccessResult {
  const isAgroTis = email.endsWith("@agrotis.com")
  const mockUser = MOCK_USERS.find((u) => u.email.toLowerCase() === email)

  // Block inactive users (DB or mock)
  if (existingCreated && inactiveIds.has(existingCreated.id)) {
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }
  if (mockUser && inactiveIds.has(mockUser.id)) {
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }

  // @agrotis.com: auto-register on first login as Padrão
  if (isAgroTis) {
    return { allow: true, autoRegister: !existingCreated && !mockUser, internalId: existingCreated?.id ?? mockUser?.id }
  }

  // Other domains: only allow if pre-registered by admin (exists in createdUser or MOCK_USERS)
  if (existingCreated || mockUser) {
    return { allow: true, autoRegister: false, internalId: existingCreated?.id ?? mockUser?.id }
  }

  // Unknown external user → block
  return { allow: false, redirect: "/login?error=UnauthorizedDomain" }
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
