export const dynamic = "force-dynamic"

import Link from "next/link"
import { Users, Monitor, Box, Building2, Sparkles, KeyRound } from "lucide-react"
import { auth } from "@/lib/auth"
import JiraConfigButton from "./JiraConfigButton"

export default async function ConfiguracoesPage() {
  const session = await auth()
  const currentEmail = session?.user?.email ?? ""

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
            href="/configuracoes/modelos-de-ia"
            className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
              <Sparkles className="size-6" />
            </div>
            <span className="font-semibold text-text-primary">Modelos de IA</span>
          </Link>

          <Link
            href="/configuracoes/credenciais"
            className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
              <KeyRound className="size-6" />
            </div>
            <span className="font-semibold text-text-primary">Credenciais</span>
          </Link>

          <JiraConfigButton defaultEmail={currentEmail} />
      </div>
    </div>
  )
}
