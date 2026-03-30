import Link from "next/link"
import { Users, Monitor, Box, Building2, Plug } from "lucide-react"

export default function ConfiguracoesPage() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href="/configuracoes/usuarios"
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Users className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Usuários</span>
        </Link>

        <Link
          href="/configuracoes/sistemas"
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Monitor className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Sistemas</span>
        </Link>

        <Link
          href="/configuracoes/modulos"
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Box className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Módulos</span>
        </Link>
        <Link
          href="/configuracoes/clientes"
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Building2 className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Clientes</span>
        </Link>

        <Link
          href="/configuracoes/integracoes"
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Plug className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Integrações</span>
        </Link>
    </div>
  )
}
