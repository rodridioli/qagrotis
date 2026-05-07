import type { Plan } from "@prisma/client"
import type { AccessProfile, UserType } from "@/lib/rbac/policy"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      /** Foto do perfil QA (upload / URL); espelha o token JWT. */
      photoPath?: string | null
      plan?: Plan
      type?: UserType
      accessProfile?: AccessProfile
    }
  }

  interface User {
    plan?: Plan
    trialEndsAt?: Date | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripeCurrentPeriodEnd?: Date | null
    type?: UserType
    accessProfile?: AccessProfile
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    type?: UserType
    accessProfile?: AccessProfile
    photoPath?: string | null
  }
}
