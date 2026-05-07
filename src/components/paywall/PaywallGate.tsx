"use client"

import type { User } from "@prisma/client"
import { hasAccess } from "@/lib/subscription"
import type { ReactNode } from "react"

interface PaywallGateProps {
  user: Pick<User, "plan" | "trialEndsAt" | "stripeCurrentPeriodEnd">
  /** Content rendered when access is granted */
  children: ReactNode
  /** Optional fallback rendered when access is denied */
  fallback?: ReactNode
}

/**
 * PaywallGate — wraps protected content.
 * Renders children only if the user has access (active trial or PRO).
 * Renders fallback (or nothing) otherwise.
 *
 * Usage:
 *   <PaywallGate user={user} fallback={<UpgradeBanner />}>
 *     <ProtectedFeature />
 *   </PaywallGate>
 *
 * NOTE: Do NOT apply to specific features yet — this gate is infrastructure only.
 */
export function PaywallGate({ user, children, fallback = null }: PaywallGateProps) {
  if (!hasAccess(user)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
