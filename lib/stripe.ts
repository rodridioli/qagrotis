import Stripe from "stripe"
import { env } from "@/lib/env"

// Lazy singleton — only instantiated when Stripe is actually used,
// so builds succeed even when STRIPE_SECRET_KEY is not configured.
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    const key = env.STRIPE_SECRET_KEY
    if (!key) throw new Error("[stripe] STRIPE_SECRET_KEY is not configured.")
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover", typescript: true })
  }
  return _stripe
}

// Named export for direct use (e.g. webhook route)
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as never)[prop as never]
  },
})

/**
 * Create a Stripe Checkout Session for a subscription.
 */
export async function createCheckoutSession({
  userId,
  email,
  stripeCustomerId,
  priceId,
  returnUrl,
}: {
  userId: string
  email: string
  stripeCustomerId?: string | null
  priceId: string
  returnUrl: string
}) {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?success=1`,
    cancel_url: `${returnUrl}?canceled=1`,
    metadata: { userId },
    subscription_data: {
      metadata: { userId },
    },
  })

  return session
}

/**
 * Create a Stripe Customer Portal session.
 */
export async function createPortalSession({
  stripeCustomerId,
  returnUrl,
}: {
  stripeCustomerId: string
  returnUrl: string
}) {
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })

  return session
}
