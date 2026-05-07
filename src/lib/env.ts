/**
 * Central environment variable access.
 * Optional vars return empty string instead of throwing — safe for prototype use.
 */

function get(name: string): string {
  return process.env[name] ?? ""
}

export const env = {
  get DATABASE_URL() { return get("DATABASE_URL") },
  get AUTH_SECRET() { return get("AUTH_SECRET") },
  get AUTH_GOOGLE_ID() { return get("AUTH_GOOGLE_ID") },
  get AUTH_GOOGLE_SECRET() { return get("AUTH_GOOGLE_SECRET") },
  get AUTH_RESEND_KEY() { return get("AUTH_RESEND_KEY") },
  get RESEND_API_KEY() { return get("RESEND_API_KEY") },
  get EMAIL_FROM() { return get("EMAIL_FROM") },
  get STRIPE_SECRET_KEY() { return get("STRIPE_SECRET_KEY") },
  get STRIPE_WEBHOOK_SECRET() { return get("STRIPE_WEBHOOK_SECRET") },
  get STRIPE_PRICE_ID_PRO() { return get("STRIPE_PRICE_ID_PRO") },
  get NEXT_PUBLIC_APP_URL() { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000" },
  get ANTHROPIC_API_KEY() { return get("ANTHROPIC_API_KEY") },
} as const
