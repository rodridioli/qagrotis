import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createCheckoutSession } from "@/lib/stripe"
import { checkoutSchema } from "@/lib/validations"
import { isSameOriginUrl, validateOrigin } from "@/lib/security"

export async function POST(req: Request) {
  // CSRF: reject cross-origin requests
  const csrfError = validateOrigin(req)
  if (csrfError) return csrfError

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    // Open redirect protection: returnUrl must be same-origin
    if (!isSameOriginUrl(parsed.data.returnUrl)) {
      return NextResponse.json(
        { error: "Invalid return URL" },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeCustomerId: true },
    })

    if (!user?.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const checkoutSession = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
      priceId: parsed.data.priceId,
      returnUrl: parsed.data.returnUrl,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[stripe/checkout]", error)
    } else {
      console.error("[stripe/checkout] Internal error")
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
