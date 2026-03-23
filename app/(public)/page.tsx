import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

// ── Hero ─────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="container mx-auto max-w-6xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Now in public beta
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
          {/* Headline placeholder */}
          Your product headline goes here
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          {/* Subheadline placeholder */}
          Describe your product value proposition in one or two sentences. What
          problem do you solve and for whom?
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href="/login">
            <Button size="lg" className="px-8">
              Start free trial
            </Button>
          </Link>
          <Link href="#features">
            <Button variant="outline" size="lg" className="px-8">
              See how it works
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          14-day free trial · No credit card required
        </p>
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────
const FEATURES_PLACEHOLDER = [
  {
    title: "Feature One",
    description: "Describe the first key feature and its benefit to the user.",
    icon: "⚡",
  },
  {
    title: "Feature Two",
    description: "Describe the second key feature and its benefit to the user.",
    icon: "🔒",
  },
  {
    title: "Feature Three",
    description: "Describe the third key feature and its benefit to the user.",
    icon: "📊",
  },
  {
    title: "Feature Four",
    description: "Describe the fourth key feature and its benefit to the user.",
    icon: "🚀",
  },
  {
    title: "Feature Five",
    description: "Describe the fifth key feature and its benefit to the user.",
    icon: "💡",
  },
  {
    title: "Feature Six",
    description: "Describe the sixth key feature and its benefit to the user.",
    icon: "🎯",
  },
]

function Features() {
  return (
    <section id="features" className="py-24 bg-secondary/30">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need
          </h2>
          <p className="mt-4 text-muted-foreground">
            {/* Features section subheadline placeholder */}
            Placeholder — replace with real product features.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES_PLACEHOLDER.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="text-3xl">{feature.icon}</div>
                <CardTitle className="mt-3">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────
function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Free / Trial plan */}
          <Card>
            <CardHeader>
              <CardTitle>Free Trial</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground"> / 14 days</span>
              </div>
              <CardDescription>
                Full access to all features during your trial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ All features included</li>
                <li>✓ No credit card required</li>
                <li>✓ 14-day trial period</li>
              </ul>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Start free trial
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Pro plan */}
          <Card className="border-primary shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pro</CardTitle>
                <Badge>Most popular</Badge>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold">$XX</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
              <CardDescription>
                {/* Pricing plan description placeholder */}
                Everything in trial, plus unlimited access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ All features included</li>
                <li>✓ Unlimited usage</li>
                <li>✓ Priority support</li>
                <li>✓ Cancel anytime</li>
              </ul>
              <Link href="/login">
                <Button className="w-full">Get started</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </>
  )
}
