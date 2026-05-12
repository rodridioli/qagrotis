export type GoogleAccessResult =
  | { allow: true; autoRegister: boolean; internalId?: string }
  | { allow: false; redirect: string }

/**
 * Access rules for Google OAuth login:
 *
 * @agrotis.com users:
 *   - Not registered or inactive → auto-register/reactivate on sign-in (autoRegister: true)
 *   - Already registered and active → allow normally (autoRegister: false)
 *
 * External users:
 *   - Not pre-registered by an admin → block (UnauthorizedDomain)
 *   - Registered but inactive → block (GoogleInactive)
 *   - Registered and active → allow
 */
export function resolveGoogleAccess(
  email: string,
  existingCreated: { id: string } | null,
  inactiveIds: Set<string>
): GoogleAccessResult {
  const isAgrotis = email.endsWith("@agrotis.com")

  if (isAgrotis) {
    // Agrotis domain: auto-register first-time users and reactivate inactive ones
    if (!existingCreated || inactiveIds.has(existingCreated.id)) {
      return { allow: true, autoRegister: true }
    }
    return { allow: true, autoRegister: false, internalId: existingCreated.id }
  }

  // External users: must be pre-registered by an admin
  if (!existingCreated) {
    return { allow: false, redirect: "/login?error=UnauthorizedDomain" }
  }
  if (inactiveIds.has(existingCreated.id)) {
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }
  return { allow: true, autoRegister: false, internalId: existingCreated.id }
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
