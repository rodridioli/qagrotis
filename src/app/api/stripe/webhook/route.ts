import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { env } from "@/lib/env"
import { db } from "@/lib/db"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  // Validate webhook secret is configured before using it
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    // Don't log the raw error — it may contain signature bytes
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }
      default:
        break
    }
  } catch (error) {
    // Log event type but never the raw error object in production
    if (process.env.NODE_ENV === "development") {
      console.error(`[webhook] Error handling ${event.type}:`, error)
    } else {
      console.error(`[webhook] Error handling event type: ${event.type}`)
    }
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

/**
 * Get current_period_end from the first subscription item (Stripe API 2026+).
 * Returns null safely if the subscription has no items.
 */
function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const items = subscription.items?.data
  if (!items || items.length === 0) return null
  const end = items[0]?.current_period_end
  if (!end || typeof end !== "number") return null
  return new Date(end * 1000)
}

/**
 * Extract a valid userId string from Stripe metadata.
 */
function extractUserId(
  metadata: Stripe.Metadata | null | undefined
): string | null {
  const id = metadata?.userId
  if (!id || typeof id !== "string" || id.trim() === "") return null
  return id
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = extractUserId(session.metadata)
  if (!userId) return

  if (typeof session.subscription !== "string" || !session.subscription) return
  if (typeof session.customer !== "string" || !session.customer) return

  const subscription = await stripe.subscriptions.retrieve(session.subscription)
  const periodEnd = getPeriodEnd(subscription)

  await db.user.update({
    where: { id: userId },
    data: {
      plan: "PRO",
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: periodEnd,
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // In Stripe API 2026+, subscription info lives in invoice.parent.subscription_details
  const parent = invoice.parent
  if (!parent || typeof parent !== "object") return

  const parentObj = parent as unknown as Record<string, unknown>
  const subscriptionDetails = parentObj["subscription_details"]
  if (!subscriptionDetails || typeof subscriptionDetails !== "object") return

  const subDetails = subscriptionDetails as Record<string, unknown>
  const rawSubscription = subDetails["subscription"]

  const subscriptionId =
    typeof rawSubscription === "string"
      ? rawSubscription
      : typeof rawSubscription === "object" &&
          rawSubscription !== null &&
          "id" in rawSubscription &&
          typeof (rawSubscription as { id: unknown }).id === "string"
        ? (rawSubscription as { id: string }).id
        : null

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = extractUserId(subscription.metadata)
  if (!userId) return

  const periodEnd = getPeriodEnd(subscription)

  await db.user.update({
    where: { id: userId },
    data: {
      plan: "PRO",
      stripeCurrentPeriodEnd: periodEnd,
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = extractUserId(subscription.metadata)
  if (!userId) return

  const isPro = subscription.status === "active"
  const periodEnd = getPeriodEnd(subscription)

  await db.user.update({
    where: { id: userId },
    data: {
      plan: isPro ? "PRO" : "FREE",
      stripeCurrentPeriodEnd: periodEnd,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = extractUserId(subscription.metadata)
  if (!userId) return

  await db.user.update({
    where: { id: userId },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
    },
  })
}
