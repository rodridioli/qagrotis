import { LoginForm } from "@/components/forms/LoginForm"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string; verify?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>

        {searchParams.verify && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
            Check your email — we sent you a sign-in link.
          </div>
        )}

        {searchParams.error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            Something went wrong. Please try again.
          </div>
        )}

        <LoginForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
      </div>
    </div>
  )
}
