export const dynamic = "force-dynamic"
export const metadata = { title: "Configurações" }

import Link from "next/link"
import { Users, Monitor, Box, Building2, Sparkles, KeyRound, UserCircle, History } from "lucide-react"
import { auth } from "@/core/auth"
import { buildRole, can, type Capability } from "@/core/rbac/policy"
import JiraConfigButton from "./JiraConfigButton"
import ClockworkConfigButton from "./ClockworkConfigButton"

interface ConfigCard {
  href: string
  icon: typeof Users
  label: string
  capability: Capability
}

const CARDS: ConfigCard[] = [
  { href: "/configuracoes/usuarios",      icon: Users,     label: "Usuários",      capability: "config.usuarios" },
  { href: "/configuracoes/sistemas",      icon: Monitor,   label: "Sistemas",      capability: "config.sistemas" },
  { href: "/configuracoes/modulos",       icon: Box,       label: "Módulos",       capability: "config.modulos" },
  { href: "/configuracoes/clientes",      icon: Building2, label: "Clientes",      capability: "config.clientes" },
  { href: "/configuracoes/modelos-de-ia", icon: Sparkles,  label: "Modelos de IA", capability: "config.modelosIA" },
  { href: "/configuracoes/credenciais",   icon: KeyRound,  label: "Credenciais",   capability: "config.credenciais" },
  { href: "/atualizacoes",               icon: History,   label: "Atualizações",  capability: "menu.atualizacoes" },
]

export default async function ConfiguracoesPage() {
  const session = await auth()
  const currentEmail = session?.user?.email ?? ""
  const userId = session?.user?.id ?? ""
  const role = buildRole(session?.user?.type, session?.user?.accessProfile)

  const visibleCards = CARDS.filter((c) => can(role, c.capability))
  const showJira = can(role, "config.jira")
  const showClockwork = can(role, "config.clockwork")
  const showMeuCadastro = can(role, "config.meuCadastro") && !!userId

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {showMeuCadastro && (
          <Link
            href={`/configuracoes/usuarios/${userId}/editar`}
            className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
              <UserCircle className="size-6" />
            </div>
            <span className="font-semibold text-text-primary">Meu Cadastro</span>
          </Link>
        )}

        {visibleCards.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
              <Icon className="size-6" />
            </div>
            <span className="font-semibold text-text-primary">{label}</span>
          </Link>
        ))}

        {showJira && <JiraConfigButton defaultEmail={currentEmail} />}
        {showClockwork && <ClockworkConfigButton />}
      </div>
    </div>
  )
}
