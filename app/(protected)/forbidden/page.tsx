import Link from "next/link"
import { ShieldAlert } from "lucide-react"

export const metadata = {
  title: "Acesso negado · qaGrotis",
}

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-custom border border-border-default bg-surface-card p-8 text-center shadow-card">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Acesso negado</h1>
        <p className="text-sm text-text-secondary">
          Seu perfil de acesso não permite visualizar esta página. Caso acredite que isso é um
          engano, fale com um administrador.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex h-9 items-center rounded-lg bg-brand-primary px-4 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
