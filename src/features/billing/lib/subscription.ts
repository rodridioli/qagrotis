import type { User } from "@prisma/client"

/** Parse a value to a valid Date, returning null if invalid. */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Returns true if the user's trial period is currently active.
 */
export function isTrialActive(user: Pick<User, "plan" | "trialEndsAt">): boolean {
  if (user.plan !== "TRIAL") return false
  const end = toDate(user.trialEndsAt)
  if (!end) return false
  return new Date() < end
}

/**
 * Returns true if the user has an active PRO subscription.
 */
export function isSubscribed(
  user: Pick<User, "plan" | "stripeCurrentPeriodEnd">
): boolean {
  if (user.plan !== "PRO") return false
  const end = toDate(user.stripeCurrentPeriodEnd)
  if (!end) return false
  return new Date() < end
}

/**
 * Returns true if the user has access to the platform.
 * Access is granted during an active trial OR with an active PRO subscription.
 */
export function hasAccess(
  user: Pick<User, "plan" | "trialEndsAt" | "stripeCurrentPeriodEnd">
): boolean {
  return isTrialActive(user) || isSubscribed(user)
}

/**
 * Returns the number of days remaining in the trial.
 * Returns 0 if the trial is not active.
 */
export function daysLeftInTrial(
  user: Pick<User, "plan" | "trialEndsAt">
): number {
  if (!isTrialActive(user)) return 0
  const end = toDate(user.trialEndsAt)
  if (!end) return 0
  const diffMs = end.getTime() - Date.now()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}
