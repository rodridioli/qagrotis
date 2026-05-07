import { LoginForm } from "@/components/forms/LoginForm"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"
import { AuthErrorToast } from "@/components/auth/AuthErrorToast"
import { Suspense } from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "QAgrotis — Entrar",
  description: "Entre na sua conta QAgrotis — Gestão de Qualidade de Software",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; verify?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-default px-4">
      <Suspense>
        <AuthErrorToast />
      </Suspense>

      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-surface-card px-8 py-10 shadow-card space-y-6">

          {/* Header — logo */}
          <div className="flex flex-col items-center gap-1 text-center">
            <QAgrotisLogo height={32} />
            <p className="mt-1 text-sm text-text-secondary">Gestão de Qualidade de Software</p>
          </div>

          {params.verify && (
            <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Verifique seu e-mail — enviamos um link de acesso.
            </div>
          )}

          <LoginForm callbackUrl={params.callbackUrl ?? "/dashboard"} />
        </div>
      </div>
    </main>
  )
}
