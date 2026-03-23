import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("[webhook] Invalid signature:", err)
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
    console.error(`[webhook] Error handling ${event.type}:`, error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

/** Get current_period_end from the first subscription item (Stripe API 2026+) */
function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0]
  if (!item?.current_period_end) return null
  return new Date(item.current_period_end * 1000)
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  if (!userId || typeof session.subscription !== "string") return

  const subscription = await stripe.subscriptions.retrieve(session.subscription)
  const periodEnd = getPeriodEnd(subscription)

  await db.user.update({
    where: { id: userId },
    data: {
      plan: "PRO",
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripeCurrentPeriodEnd: periodEnd,
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Subscription ID lives in invoice.parent.subscription_details in new API
  const parent = invoice.parent as
    | { type: string; subscription_details?: { subscription: string | Stripe.Subscription } }
    | null

  const subscriptionId =
    typeof parent?.subscription_details?.subscription === "string"
      ? parent.subscription_details.subscription
      : (parent?.subscription_details?.subscription as Stripe.Subscription | undefined)?.id

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.userId
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
  const userId = subscription.metadata?.userId
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
  const userId = subscription.metadata?.userId
  if (!userId) return

  await db.user.update({
    where: { id: userId },
    data: {
      plan: "FREE",
      stripeSubscriptionId: null,
    },
  })
}
