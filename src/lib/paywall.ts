import type { User } from "@prisma/client"
import { hasAccess } from "@/lib/subscription"

// ── Plan Limits ──────────────────────────────────────────────
// Define per-resource limits for each plan.
// -1 means unlimited.
export const PLAN_LIMITS = {
  FREE: {
    projects: 1,
    teamMembers: 1,
    apiCalls: 100,
    storageGb: 1,
  },
  TRIAL: {
    projects: 5,
    teamMembers: 3,
    apiCalls: 1000,
    storageGb: 5,
  },
  PRO: {
    projects: -1,
    teamMembers: -1,
    apiCalls: -1,
    storageGb: 100,
  },
} as const

export type PlanResource = keyof (typeof PLAN_LIMITS)["FREE"]

// ── Usage Check ───────────────────────────────────────────────
export type UsageLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "no_access" | "limit_reached"; limit: number }

/**
 * Check if a user can use a resource given their current plan.
 * @param user - the current user
 * @param resource - the resource to check
 * @param currentUsage - how much of the resource the user has already used
 */
export function checkUsageLimit(
  user: Pick<User, "plan" | "trialEndsAt" | "stripeCurrentPeriodEnd">,
  resource: PlanResource,
  currentUsage = 0
): UsageLimitResult {
  if (!hasAccess(user)) {
    return { allowed: false, reason: "no_access", limit: 0 }
  }

  const limits = PLAN_LIMITS[user.plan]
  const limit = limits[resource]

  if (limit === -1) return { allowed: true }

  if (currentUsage >= limit) {
    return { allowed: false, reason: "limit_reached", limit }
  }

  return { allowed: true }
}
