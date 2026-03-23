import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { daysLeftInTrial, hasAccess, isSubscribed } from "@/lib/subscription"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      trialEndsAt: true,
      stripeCurrentPeriodEnd: true,
    },
  })

  if (!user) redirect("/login")

  const access = hasAccess(user)
  const subscribed = isSubscribed(user)
  const trialDays = daysLeftInTrial(user)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {user.name ?? user.email}
      </p>

      <div className="mt-8 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Account Status</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground">Plan:</span>
            <span className="font-medium">{user.plan}</span>
          </div>
          {user.plan === "TRIAL" && (
            <div className="flex gap-2">
              <span className="text-muted-foreground">Trial days left:</span>
              <span className="font-medium">{trialDays}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground">Access:</span>
            <span className={`font-medium ${access ? "text-green-600" : "text-destructive"}`}>
              {access ? "Active" : "Expired"}
            </span>
          </div>
        </div>

        {!subscribed && (
          <div className="mt-6">
            <a
              href="/api/stripe/checkout"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Upgrade to Pro
            </a>
          </div>
        )}
      </div>

      {/* Product features will be added here */}
      <div className="mt-8 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Your product features go here</p>
        <p className="mt-2 text-sm">
          This dashboard is a placeholder. Add your features in separate prompts.
        </p>
      </div>
    </div>
  )
}
