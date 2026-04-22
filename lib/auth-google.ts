export type GoogleAccessResult =
  | { allow: true; autoRegister: boolean; internalId?: string }
  | { allow: false; redirect: string }

/**
 * Access rules for Google OAuth login:
 *
 * 1. @agrotis.com → always allowed; auto-registered as "Padrão" if first login
 * 2. Other domains → only allowed if an admin pre-registered the email in CreatedUser
 * 3. Inactive users → always blocked
 */
export function resolveGoogleAccess(
  email: string,
  existingCreated: { id: string } | null,
  inactiveIds: Set<string>
): GoogleAccessResult {
  const isAgroTis = email.endsWith("@agrotis.com")

  // Inativo: bloqueia domínios externos; @agrotis.com segue para reativação no callback signIn.
  if (existingCreated && inactiveIds.has(existingCreated.id)) {
    if (isAgroTis) {
      return { allow: true, autoRegister: true, internalId: existingCreated.id }
    }
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }

  if (isAgroTis) {
    return {
      allow: true,
      autoRegister: !existingCreated,
      internalId: existingCreated?.id,
    }
  }

  if (existingCreated) {
    return { allow: true, autoRegister: false, internalId: existingCreated.id }
  }

  return { allow: false, redirect: "/login?error=UnauthorizedDomain" }
}

/**
 * Resolves the internal user ID for a Google-authenticated user.
 * Priority: createdUser DB record → OAuth subject (NextAuth User id).
 */
export function resolveGoogleInternalId(
  _email: string,
  createdId: string | null | undefined,
  fallbackId: string
): string {
  if (createdId) return createdId
  return fallbackId
}
