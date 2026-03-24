/**
 * Central environment variable validation.
 *
 * Uses lazy getters — variables are validated at runtime when first accessed,
 * NOT at module import time, to avoid breaking Next.js builds.
 *
 * Usage:
 *   import { env } from "@/lib/env"
 *   const secret = env.STRIPE_SECRET_KEY   // throws if not defined
 */

function get(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Missing required environment variable: "${name}"\n` +
        `Copy .env.example → .env and fill in all values before running.`
    )
  }
  return value
}

export const env = {
  get DATABASE_URL() {
    return get("DATABASE_URL")
  },
  get AUTH_SECRET() {
    return get("AUTH_SECRET")
  },
  get AUTH_GOOGLE_ID() {
    return get("AUTH_GOOGLE_ID")
  },
  get AUTH_GOOGLE_SECRET() {
    return get("AUTH_GOOGLE_SECRET")
  },
  get AUTH_RESEND_KEY() {
    return get("AUTH_RESEND_KEY")
  },
  get RESEND_API_KEY() {
    return get("RESEND_API_KEY")
  },
  get EMAIL_FROM() {
    return get("EMAIL_FROM")
  },
  get STRIPE_SECRET_KEY() {
    return get("STRIPE_SECRET_KEY")
  },
  get STRIPE_WEBHOOK_SECRET() {
    return get("STRIPE_WEBHOOK_SECRET")
  },
  get STRIPE_PRICE_ID_PRO() {
    return get("STRIPE_PRICE_ID_PRO")
  },
  get NEXT_PUBLIC_APP_URL() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  },
} as const
