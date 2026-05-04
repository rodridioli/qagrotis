export type GoogleAccessResult =
  | { allow: true; autoRegister: boolean; internalId?: string }
  | { allow: false; redirect: string }

/**
 * Access rules for Google OAuth login:
 *
 * 1. User must have been pre-registered in CreatedUser by an admin — no auto-registration.
 * 2. Inactive users → always blocked, regardless of domain.
 * 3. Any e-mail domain is accepted as long as the address was pre-registered.
 */
export function resolveGoogleAccess(
  _email: string,
  existingCreated: { id: string } | null,
  inactiveIds: Set<string>
): GoogleAccessResult {
  // Not pre-registered — block regardless of domain.
  if (!existingCreated) {
    return { allow: false, redirect: "/login?error=UnauthorizedDomain" }
  }

  // Pre-registered but inactive — block.
  if (inactiveIds.has(existingCreated.id)) {
    return { allow: false, redirect: "/login?error=GoogleInactive" }
  }

  // Pre-registered and active — allow.
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
