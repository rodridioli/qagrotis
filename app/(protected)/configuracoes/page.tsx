export const dynamic = "force-dynamic"

import Link from "next/link"
import { Users, Monitor, Box, Building2, Plug } from "lucide-react"
import { checkIsAdmin } from "@/lib/session"
import LimparBancoButton from "./LimparBancoButton"

export default async function ConfiguracoesPage() {
  const isAdmin = await checkIsAdmin()

  return (
    <div className="flex flex-col gap-6">
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
            <span className="font-semibold text-text-primary">Modelos de IA</span>
          </Link>
      </div>

      {isAdmin && (
        <div>
          <div className="rounded-xl border border-neutral-grey-200 bg-surface-card p-6 shadow-card">
            <LimparBancoButton />
          </div>
        </div>
      )}
    </div>
  )
}
