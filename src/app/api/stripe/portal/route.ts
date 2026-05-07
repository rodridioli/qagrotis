import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createPortalSession } from "@/lib/stripe"
import { z } from "zod"
import { isSameOriginUrl, validateOrigin } from "@/lib/security"

const schema = z.object({
  returnUrl: z.string().url(),
})

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
    const parsed = schema.safeParse(body)
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
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 }
      )
    }

    const portalSession = await createPortalSession({
      stripeCustomerId: user.stripeCustomerId,
      returnUrl: parsed.data.returnUrl,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[stripe/portal]", error)
    } else {
      console.error("[stripe/portal] Internal error")
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
