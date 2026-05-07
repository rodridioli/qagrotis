import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  hasAccess,
  isSubscribed,
  daysLeftInTrial,
} from "@/lib/subscription"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        trialEndsAt: true,
        stripeCurrentPeriodEnd: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      plan: user.plan,
      hasAccess: hasAccess(user),
      isSubscribed: isSubscribed(user),
      trialDaysLeft: daysLeftInTrial(user),
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
