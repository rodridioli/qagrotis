import { LoginForm } from "@/components/forms/LoginForm"
import type { Metadata } from "next"
import { House, Mail, Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "QAgrotis — Entrar",
  description: "Entre na sua conta QAgrotis",
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string; verify?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-default px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-surface-card p-8 shadow-card space-y-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-primary text-white">
              <House className="size-6" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">QAgrotis</h1>
            <p className="text-sm text-text-secondary">
              Gestão de Qualidade de Software
            </p>
          </div>

          {searchParams.verify && (
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
              Verifique seu e-mail — enviamos um link de acesso.
            </div>
          )}

          {searchParams.error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
              Ocorreu um erro. Por favor, tente novamente.
            </div>
          )}

          <LoginForm callbackUrl={searchParams.callbackUrl ?? "/dashboard"} />
        </div>
      </div>
    </div>
  )
}
