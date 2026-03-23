import type { Plan } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      plan?: Plan
    }
  }

  interface User {
    plan?: Plan
    trialEndsAt?: Date | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripeCurrentPeriodEnd?: Date | null
  }
}
