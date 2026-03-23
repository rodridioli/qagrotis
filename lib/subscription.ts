import type { User } from "@prisma/client"

/**
 * Returns true if the user's trial period is currently active.
 */
export function isTrialActive(user: Pick<User, "plan" | "trialEndsAt">): boolean {
  if (user.plan !== "TRIAL") return false
  if (!user.trialEndsAt) return false
  return new Date() < new Date(user.trialEndsAt)
}

/**
 * Returns true if the user has an active PRO subscription.
 */
export function isSubscribed(
  user: Pick<User, "plan" | "stripeCurrentPeriodEnd">
): boolean {
  if (user.plan !== "PRO") return false
  if (!user.stripeCurrentPeriodEnd) return false
  return new Date() < new Date(user.stripeCurrentPeriodEnd)
}

/**
 * Returns true if the user has access to the platform.
 * Access is granted during an active trial OR with an active subscription.
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
  if (!isTrialActive(user) || !user.trialEndsAt) return 0
  const now = new Date()
  const end = new Date(user.trialEndsAt)
  const diffMs = end.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}
