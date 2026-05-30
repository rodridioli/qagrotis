/**
 * Central environment variable access.
 * - required(): throws at access time if the var is missing (critical vars).
 * - optional(): returns empty string when absent — safe for feature-flagged vars.
 *
 * ENCRYPTION_KEY is validated separately at startup (see bottom of file).
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
      `Check your .env file or deployment configuration.`
    )
  }
  return v
}

function optional(name: string): string {
  return process.env[name] ?? ""
}

export const env = {
  /** Required — app cannot start without a database. */
  get DATABASE_URL() { return required("DATABASE_URL") },
  /** Required — Auth.js will not sign/verify sessions without a secret. */
  get AUTH_SECRET() { return required("AUTH_SECRET") },
  /** Optional — only needed for Google OAuth login. */
  get AUTH_GOOGLE_ID() { return optional("AUTH_GOOGLE_ID") },
  /** Optional — only needed for Google OAuth login. */
  get AUTH_GOOGLE_SECRET() { return optional("AUTH_GOOGLE_SECRET") },
  /** Optional — used for magic-link auth via Resend. */
  get AUTH_RESEND_KEY() { return optional("AUTH_RESEND_KEY") },
  /** Optional — used for transactional emails via Resend. */
  get RESEND_API_KEY() { return optional("RESEND_API_KEY") },
  /** Optional — sender address for outgoing emails. */
  get EMAIL_FROM() { return optional("EMAIL_FROM") },
  /** Optional — only needed for Stripe billing. */
  get STRIPE_SECRET_KEY() { return optional("STRIPE_SECRET_KEY") },
  /** Optional — only needed for Stripe webhook validation. */
  get STRIPE_WEBHOOK_SECRET() { return optional("STRIPE_WEBHOOK_SECRET") },
  /** Optional — Stripe price ID for the PRO plan. */
  get STRIPE_PRICE_ID_PRO() { return optional("STRIPE_PRICE_ID_PRO") },
  get NEXT_PUBLIC_APP_URL() { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" },
  /** Optional — only needed if Anthropic is used as default AI provider. */
  get ANTHROPIC_API_KEY() { return optional("ANTHROPIC_API_KEY") },
  /** Optional: Clockwork Pro — lista worklogs por e-mail (api.clockwork.report). Ver .env.example. */
  get CLOCKWORK_API_TOKEN() { return optional("CLOCKWORK_API_TOKEN") },
} as const

/**
 * Warn loudly in non-test environments when ENCRYPTION_KEY is not configured.
 * In production, db-utils.ts already throws — this catches it earlier (module load time).
 */
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  const encKey = process.env.ENCRYPTION_KEY
  if (!encKey || encKey.length !== 64) {
    if (process.env.NODE_ENV === "production") {
      // In production throw immediately — sensitive fields cannot be stored safely without it.
      throw new Error(
        "[env] ENCRYPTION_KEY is required in production. " +
        "Generate a 64-char hex key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      )
    } else {
      // In development, warn but allow startup (useful for initial project setup).
      console.warn(
        "[env] WARNING: ENCRYPTION_KEY is not set. Sensitive fields (API keys, passwords) " +
        "will be stored without encryption. Set a 64-char hex key in your .env file before handling real data."
      )
    }
  }
}
