import Stripe from "stripe"
import { env } from "@/lib/env"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
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
  const session = await stripe.checkout.sessions.create({
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
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })

  return session
}
