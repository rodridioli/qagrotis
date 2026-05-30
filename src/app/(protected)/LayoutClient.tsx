"use client"

import React, { useState, useEffect, useTransition, useRef, Suspense } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  LayoutDashboard, FileText, Rocket, Check, Clock4,
  Settings, LogOut, PanelLeftClose,
  PanelLeftOpen, Menu, Moon, Sun, Sparkles, Users,
  Network, ClipboardCheck, MessageSquare, User, KanbanSquare, Briefcase,
} from "lucide-react"
import { buildRole, can, isDisabled, isVisible, type Role, type Capability, type AccessProfile } from "@/core/rbac/policy"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/core/utils"
import { IndividualSidebarNavGroup } from "@/features/individual/components/IndividualSidebarNavGroup"
import { individualSectionLabel } from "@/features/individual/lib/individual-sections"
import { EquipeSidebarNavGroup } from "@/features/equipe/components/EquipeSidebarNavGroup"
import { EQUIPE_NAV_ENTRIES } from "@/features/equipe/components/equipeNavEntries"
import { PainelSidebarNavGroup } from "@/features/painel/components/PainelSidebarNavGroup"
import { GestaoSidebarNavGroup } from "@/features/gestao/components/GestaoSidebarNavGroup"
import { QAgrotisLogo } from "@/components/shared/QAgrotisLogo"
import { QAgrotisIcon } from "@/components/shared/QAgrotisIcon"
import { signOut, useSession } from "next-auth/react"
import { SistemaContext } from "@/core/modulo-context"
import { AssistenteDrawer } from "@/components/shared/AssistenteDrawer"
import type { IntegracaoSafeRecord } from "@/features/integracoes/actions/integracoes"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { BackToTop } from "@/components/shared/BackToTop"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { DominioResponderSheet } from "@/features/individual/components/DominioResponderSheet"
import {
  completarDominioAvaliacao,
  type PendingDominioAvaliacaoDto,
} from "@/features/individual/actions/individual-dominio"

const STORAGE_KEY = "qa_sistema_selecionado"
const THEME_KEY = "qa_theme"

const NAV_ITEMS: Array<{ href: string; icon: typeof Rocket; label: string; alwaysEnabled: boolean; capability: Capability }> = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Painel",           alwaysEnabled: false, capability: "menu.painel" },
  { href: "/suites",        icon: Rocket,          label: "Suítes",           alwaysEnabled: false, capability: "menu.suites" },
  { href: "/cenarios",      icon: FileText,        label: "Cenários",         alwaysEnabled: false, capability: "menu.cenarios" },
  { href: "/gestao",                   icon: Briefcase,    label: "Gestão",      alwaysEnabled: true,  capability: "menu.gestao" },
  { href: "/kanban",                  icon: KanbanSquare, label: "Kanban",      alwaysEnabled: true,  capability: "menu.kanban" },
  { href: "/equipe?tab=lancamentos", icon: Check,       label: "Registros",   alwaysEnabled: true,  capability: "equipe.lancamentos" },
  { href: "/equipe?tab=clockwork",   icon: Clock4,     label: "Clockwork",   alwaysEnabled: true,  capability: "equipe.clockwork" },
  { href: "/individual/lancamentos", icon: Check,      label: "Registros",   alwaysEnabled: false, capability: "individual.lancamentos" },
  { href: "/gerador",       icon: Sparkles,        label: "Gerador",          alwaysEnabled: false, capability: "menu.gerador" },
  { href: "/mapa-conhecimento",     icon: Network,         label: "Mapa de Conhecimento",   alwaysEnabled: true,  capability: "menu.mapaConhecimento" },
  { href: "/avaliacao-desempenho",  icon: ClipboardCheck,  label: "Avaliação de Desempenho", alwaysEnabled: true,  capability: "menu.avaliacaoDesempenho" },
  { href: "/feedbacks",             icon: MessageSquare,   label: "Feedbacks",              alwaysEnabled: true,  capability: "menu.feedbacks" },
  { href: "/configuracoes", icon: Settings,        label: "Configurações",          alwaysEnabled: true,  capability: "menu.configuracoes" },
  { href: "/equipe",        icon: Users,           label: "Equipe",                 alwaysEnabled: true,  capability: "menu.equipe" },
  { href: "/individual",    icon: User,            label: "Individual",             alwaysEnabled: true,  capability: "menu.individual" },
]

/**
 * Overrides de menu por Role: ordem dos itens + relabel opcional.
 * Quando há override, só os itens listados aparecem (na ordem dada).
 * Sem override → ordem padrão de NAV_ITEMS.
 */
const MENU_OVERRIDE_BY_ROLE: Partial<Record<Role, Array<{ capability: Capability; label?: string }>>> = {
  "Administrador:MGR": [
    { capability: "menu.painel" },
    { capability: "menu.gestao" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Padrão:UX": [
    { capability: "menu.kanban" },
    { capability: "individual.lancamentos" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Padrão:TW": [
    { capability: "individual.lancamentos" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Padrão:QA": [
    { capability: "menu.painel" },
    { capability: "individual.lancamentos" },
    { capability: "menu.suites" },
    { capability: "menu.cenarios" },
    { capability: "menu.gerador" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Administrador:QA": [
    { capability: "menu.painel" },
    { capability: "equipe.lancamentos", label: "Registros" },
    { capability: "equipe.clockwork", label: "Clockwork" },
    { capability: "menu.suites" },
    { capability: "menu.cenarios" },
    { capability: "menu.gerador" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Administrador:UX": [
    { capability: "menu.kanban" },
    { capability: "equipe.lancamentos", label: "Registros" },
    { capability: "equipe.clockwork", label: "Clockwork" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
  "Administrador:TW": [
    { capability: "equipe.lancamentos", label: "Registros" },
    { capability: "equipe.clockwork", label: "Clockwork" },
    { capability: "menu.equipe" },
    { capability: "menu.individual" },
    { capability: "menu.configuracoes" },
  ],
}

const TITLE_MAP: Record<string, string> = {
  "/kanban":        "Kanban",
  "/dashboard":     "Painel",
  "/cenarios":      "Cenários",
  "/gerador":       "Gerador",
  "/suites":        "Suítes",
  "/documentos":    "Documentos",
  "/configuracoes": "Configurações",
  "/assistente":    "Central de Ajuda",
  "/atualizacoes":  "Atualizações",
  "/equipe":        "Equipe",
  "/individual":    "Individual",
}

function getTitle(pathname: string, role?: Role, tab?: string): string {
  if (
    role?.startsWith("Padrão:") &&
    /^\/configuracoes\/usuarios\/[^/]+\/editar$/.test(pathname)
  ) {
    return "Meu Cadastro"
  }
  if (pathname === "/dashboard" && tab) {
    const perfil = tab.toUpperCase()
    if (["MGR", "QA", "UX", "TW"].includes(perfil)) return `Painel — ${perfil}`
  }
  if (pathname.startsWith("/individual/avaliacoes/nova")) return "Nova avaliação"
  if (/^\/individual\/avaliacoes\/[^/]+$/.test(pathname)) return "Avaliação de desempenho"
  if (pathname === "/individual/lancamentos") return "Registros"
  if (pathname.startsWith("/individual/")) {
    const secao = pathname.split("/")[2] ?? ""
    const label = individualSectionLabel(secao)
    if (label) return `Individual — ${label}`
  }
  if (pathname.startsWith("/equipe")) {
    if (tab === "clockwork") return "Clockwork"
    if (role === "Administrador:MGR") {
      if (tab === "lancamentos") return "Registros"
    }
    const entry = EQUIPE_NAV_ENTRIES.find((e) => e.id === tab)
    if (entry) return `Equipe — ${entry.label}`
    return "Equipe"
  }
  for (const [key, value] of Object.entries(TITLE_MAP)) {
    if (pathname.startsWith(key)) return value
  }
  return "QAgrotis"
}

// ── Sidebar ─────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  isDark: boolean
  assistenteOpen: boolean
  onAssistenteOpen: () => void
  hasSistemaModulo: boolean
  hasCenario: boolean
  hasIntegracoes: boolean
  hasJiraConfigured: boolean
  role: Role
  canAccessEquipeLancamentos: boolean
  /** Navegação com transição (mantém overlay de carregamento até a rota resolver). */
  onNavigate?: (href: string) => void
}

const Sidebar = React.memo(function Sidebar({ collapsed, mobileOpen, onCloseMobile, isDark, assistenteOpen, onAssistenteOpen, hasSistemaModulo, hasCenario, hasIntegracoes, hasJiraConfigured, role, canAccessEquipeLancamentos, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const sidebarSearchParams = useSearchParams()

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex h-screen flex-col border-r border-border-default bg-surface-card text-text-primary transition-[transform,width] duration-200",
          "fixed inset-y-0 left-0 z-50 w-52",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:relative lg:translate-x-0",
          collapsed ? "lg:w-14" : "lg:w-52"
        )}
      >
        <div className={cn(
          "flex h-14 shrink-0 items-center border-b border-border-default",
          collapsed ? "lg:justify-center lg:px-0 px-4" : "px-4"
        )}>
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault()
                onNavigate("/dashboard")
              }
            }}
          >
            {collapsed
              ? <span className="hidden lg:block"><QAgrotisIcon size={20} className="text-brand-primary" /></span>
              : null}
            <span className={cn(collapsed ? "lg:hidden" : "")}>
              <QAgrotisLogo height={26} isDark={isDark} />
            </span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          <TooltipProvider>
            {(() => {
              const override = MENU_OVERRIDE_BY_ROLE[role]
              if (!override) {
                return NAV_ITEMS.filter((item) => isVisible(role, item.capability))
              }
              const byCapability = new Map(NAV_ITEMS.map((it) => [it.capability, it]))
              return override.flatMap(({ capability, label }) => {
                const base = byCapability.get(capability)
                if (!base || !isVisible(role, capability)) return []
                // Ocultar completamente o Gerador para perfis QA quando
                // Jira ou modelos IA não estiverem configurados.
                if (capability === "menu.gerador" && (!hasIntegracoes || !hasJiraConfigured)) return []
                // Ocultar Lançamentos para Padrão:QA sem Jira configurado.
                if (capability === "individual.lancamentos" && role === "Padrão:QA" && !hasJiraConfigured) return []
                return [{ ...base, label: label ?? base.label }]
              })
            })().map(({ href, icon: Icon, label, alwaysEnabled, capability }) => {
              // Disable logic: only applies to roles that depend on sistema/módulo
              const needsSistema = can(role, "topbar.sistemaSelector")

              if (href === "/dashboard" && role === "Administrador:MGR") {
                return (
                  <Suspense
                    key="painel-sidebar-tree"
                    fallback={
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-text-secondary",
                          collapsed ? "lg:justify-center" : "",
                        )}
                      >
                        <LayoutDashboard className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                        {!collapsed ? <span className="truncate">Painel</span> : null}
                      </div>
                    }
                  >
                    <PainelSidebarNavGroup collapsed={collapsed} onNavigate={onNavigate} />
                  </Suspense>
                )
              }

              if (href === "/gestao") {
                return (
                  <Suspense
                    key="gestao-sidebar-tree"
                    fallback={
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-text-secondary",
                          collapsed ? "lg:justify-center" : "",
                        )}
                      >
                        <Briefcase className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                        {!collapsed ? <span className="truncate">Gestão</span> : null}
                      </div>
                    }
                  >
                    <GestaoSidebarNavGroup collapsed={collapsed} onNavigate={onNavigate} />
                  </Suspense>
                )
              }

              if (href === "/equipe") {
                const equipeDisabled = needsSistema && !hasSistemaModulo
                if (equipeDisabled) {
                  return (
                    <span
                      key="equipe-disabled"
                      className={cn(
                        "flex cursor-not-allowed items-center gap-3 rounded px-2.5 py-2 text-sm font-medium opacity-40",
                        collapsed ? "lg:justify-center" : "",
                      )}
                    >
                      <Users className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                      {!collapsed ? <span className="truncate text-text-secondary">Equipe</span> : null}
                    </span>
                  )
                }
                return (
                  <Suspense
                    key="equipe-sidebar-tree"
                    fallback={
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-text-secondary",
                          collapsed ? "lg:justify-center" : "",
                        )}
                      >
                        <Users className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                        {!collapsed ? <span className="truncate">Equipe</span> : null}
                      </div>
                    }
                  >
                    <EquipeSidebarNavGroup
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                      canAccessLancamentos={role === "Administrador:MGR" || role === "Administrador:QA" || role === "Administrador:UX" || role === "Administrador:TW" ? false : canAccessEquipeLancamentos}
                      hideClockwork={true}
                    />
                  </Suspense>
                )
              }

              if (href === "/individual") {
                const individualDisabled = needsSistema && !hasSistemaModulo
                if (individualDisabled) {
                  return (
                    <span
                      key="individual-disabled"
                      className={cn(
                        "flex cursor-not-allowed items-center gap-3 rounded px-2.5 py-2 text-sm font-medium opacity-40",
                        collapsed ? "lg:justify-center" : "",
                      )}
                    >
                      <User className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                      {!collapsed ? <span className="truncate text-text-secondary">Individual</span> : null}
                    </span>
                  )
                }
                return (
                  <Suspense
                    key="individual-sidebar-tree"
                    fallback={
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-text-secondary",
                          collapsed ? "lg:justify-center" : "",
                        )}
                      >
                        <User className="size-4.5 shrink-0 text-text-secondary" aria-hidden />
                        {!collapsed ? <span className="truncate">Individual</span> : null}
                      </div>
                    }
                  >
                    <IndividualSidebarNavGroup
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </Suspense>
                )
              }

              // RBAC primeiro: se policy diz que está disabled (item visível mas inativo), respeita.
              const rbacDisabled = isDisabled(role, capability)
              // Depois, contexto (sem sistema/integração) só se RBAC permite a feature.
              let disabled = rbacDisabled
              if (!disabled && !alwaysEnabled) {
                if (href === "/gerador" || href === "/assistente") {
                  disabled = !hasIntegracoes
                } else if (href === "/suites") {
                  disabled = needsSistema && (!hasSistemaModulo || !hasCenario || !hasJiraConfigured)
                } else if (href === "/dashboard" || href === "/cenarios") {
                  disabled = needsSistema && !hasSistemaModulo
                }
              }
              // Lançamentos e Clockwork têm alwaysEnabled:true no NAV_ITEMS, por isso
              // precisam de bloco separado. Para perfis que dependem de Sistema (QA),
              // desabilita quando não houver módulo cadastrado.
              if (!disabled && needsSistema) {
                if (href === "/equipe?tab=lancamentos" || href === "/equipe?tab=clockwork") {
                  disabled = !hasSistemaModulo
                }
              }

              const isAssistente = href === "/assistente"
              const isActive = href === "/equipe?tab=lancamentos"
                ? pathname === "/equipe" && sidebarSearchParams.get("tab") === "lancamentos"
                : href === "/equipe?tab=clockwork"
                  ? pathname === "/equipe" && sidebarSearchParams.get("tab") === "clockwork"
                  : isAssistente
                    ? assistenteOpen
                    : !disabled && pathname.startsWith(href)
              const showLabel = !collapsed

              if (disabled) {
                return (
                  <span
                    key={href}
                    className={cn(
                      "flex cursor-not-allowed items-center gap-3 rounded px-2.5 py-2 text-sm font-medium opacity-40",
                      collapsed ? "lg:justify-center" : ""
                    )}
                  >
                    <Icon className="size-4.5 shrink-0 text-text-secondary" />
                    {showLabel && <span className="truncate text-text-secondary">{label}</span>}
                  </span>
                )
              }

              const itemClassName = cn(
                "group flex cursor-pointer items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-150",
                collapsed ? "lg:justify-center" : "",
                isActive
                  ? "bg-brand-primary text-white"
                  : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary hover:translate-x-0.5"
              )
              const itemStyle = isActive ? { color: "#ffffff" } : undefined
              const itemChildren = (
                <>
                  <Icon className={cn("size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110", isActive ? "text-white" : "")} />
                  {showLabel && <span className="truncate">{label}</span>}
                </>
              )

              // "Assistente de IA" is a drawer trigger, not a route link
              if (isAssistente) {
                if (!hasIntegracoes) {
                  const disabledClassName = cn(
                    "flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-text-secondary opacity-50 cursor-not-allowed",
                    collapsed ? "lg:justify-center" : ""
                  )
                  if (!showLabel) {
                    return (
                      <Tooltip key={href}>
                        <TooltipTrigger render={<span className={cn(disabledClassName, "w-full")} />}>
                          {itemChildren}
                        </TooltipTrigger>
                        <TooltipContent>{label} (Desabilitado)</TooltipContent>
                      </Tooltip>
                    )
                  }
                  return (
                    <span key={href} className={cn(disabledClassName, "w-full")}>
                      {itemChildren}
                    </span>
                  )
                }

                if (!showLabel) {
                  return (
                    <Tooltip key={href}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={onAssistenteOpen}
                            style={itemStyle}
                            className={cn(itemClassName, "w-full cursor-pointer")}
                          />
                        }
                      >
                        {itemChildren}
                      </TooltipTrigger>
                      <TooltipContent>{label}</TooltipContent>
                    </Tooltip>
                  )
                }
                return (
                  <button
                    key={href}
                    type="button"
                    onClick={onAssistenteOpen}
                    style={itemStyle}
                    className={cn(itemClassName, "w-full cursor-pointer")}
                  >
                    {itemChildren}
                  </button>
                )
              }

              if (!showLabel) {
                return (
                  <Tooltip key={href}>
                    <TooltipTrigger render={
                      <button type="button" style={itemStyle} className={itemClassName}
                        onClick={() => (onNavigate ? onNavigate(href) : router.push(href))} />
                    }>
                      {itemChildren}
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <button key={href} type="button" style={itemStyle} className={itemClassName}
                  onClick={() => (onNavigate ? onNavigate(href) : router.push(href))}>
                  {itemChildren}
                </button>
              )
            })}
          </TooltipProvider>
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-border-default px-2 py-3">
          <TooltipProvider>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="flex w-full cursor-pointer items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-destructive transition-all duration-150 hover:bg-neutral-grey-100 lg:justify-center"
                    />
                  }
                >
                  <LogOut className="size-4.5 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>Sair do Sistema</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full cursor-pointer items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-destructive transition-all duration-150 hover:bg-neutral-grey-100 hover:translate-x-0.5"
              >
                <LogOut className="size-4.5 shrink-0" />
                <span className="truncate">Sair do Sistema</span>
              </button>
            )}
          </TooltipProvider>
        </div>
      </aside>
    </>
  )
})

// ── Topbar ──────────────────────────────────────────────────
interface TopbarProps {
  collapsed: boolean
  onToggleDesktop: () => void
  onToggleMobile: () => void
  sistemaNames: string[]
  sistemaSelecionado: string
  onSistemaChange: (v: string) => void
  /** Bloqueia o seletor enquanto a UI aplica o novo sistema. */
  sistemaSelectPending?: boolean
  isDark: boolean
  onToggleTheme: () => void
  role: Role
  accessProfile: AccessProfile
}

const PROFILE_BADGE: Record<AccessProfile, { bg: string; label: string }> = {
  QA:  { bg: "bg-emerald-500", label: "QA"  },
  UX:  { bg: "bg-violet-500",  label: "UX"  },
  TW:  { bg: "bg-amber-500",   label: "TW"  },
  MGR: { bg: "bg-sky-600",     label: "MGR" },
}

const Topbar = React.memo(function Topbar({
  collapsed,
  onToggleDesktop,
  onToggleMobile,
  sistemaNames,
  sistemaSelecionado,
  onSistemaChange,
  sistemaSelectPending = false,
  isDark,
  onToggleTheme,
  role,
  accessProfile,
}: TopbarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? searchParams.get("perfil") ?? undefined
  const title = getTitle(pathname, role, tab)
  const { data: session } = useSession()
  /** Evita mismatch de hidratação: no SSR o cliente ainda não aplicou a sessão do browser. */
  const [sessionUiReady, setSessionUiReady] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setSessionUiReady(true))
  }, [])

  const sessionForUi = sessionUiReady ? session : undefined
  const displayName = sessionForUi?.user?.name ?? sessionForUi?.user?.email ?? ""
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "QA"
  const sessionPhoto = sessionForUi?.user?.photoPath ?? null
  const internalId = sessionForUi?.user?.id
  const avatarApi = internalId ? `/api/usuarios/${internalId}/avatar` : null
  /** `data:` não entra no JWT (limite do cookie); avatar enviado pelo formulário usa a API. */
  const avatarSrc =
    sessionPhoto && !sessionPhoto.startsWith("data:")
      ? sessionPhoto
      : avatarApi
  const [avatarFailed, setAvatarFailed] = useState(false)
  useEffect(() => {
    queueMicrotask(() => setAvatarFailed(false))
  }, [avatarSrc])
  const profileHref = internalId
    ? `/configuracoes/usuarios/${internalId}/editar`
    : "/configuracoes/usuarios"

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-surface-card px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label="Abrir menu"
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 lg:hidden"
        >
          <Menu className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleDesktop}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 lg:flex"
        >
          {collapsed
            ? <PanelLeftOpen className="size-4" />
            : <PanelLeftClose className="size-4" />
          }
        </button>
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
        >
          {isDark
            ? <Sun className="size-4" />
            : <Moon className="size-4" />
          }
        </button>
        {can(role, "topbar.sistemaSelector") && (
          sistemaNames.length > 0 ? (
            <Select
              value={sistemaSelecionado}
              onValueChange={(v) => onSistemaChange(v ?? "")}
              disabled={sistemaSelectPending}
            >
              <SelectTrigger className="h-8 flex w-24 max-w-24 gap-1 overflow-hidden px-2 text-xs sm:w-auto sm:min-w-32 sm:max-w-56 sm:gap-1.5 sm:px-3 sm:text-sm">
                <span className="hidden sm:inline truncate text-text-secondary">Sistema: </span>
                <SelectValue className="truncate font-medium" />
              </SelectTrigger>
              <SelectPopup>
                {sistemaNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-custom border border-border-default bg-surface-input px-3 py-1.5 text-sm text-text-secondary/60">
              <span className="text-text-secondary">Sistema:</span>
              <span className="font-medium">Não cadastrado</span>
            </span>
          )
        )}
        {sessionUiReady && (
          <span
            className={cn(
              "hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white",
              PROFILE_BADGE[accessProfile].bg
            )}
            title={`Perfil de acesso: ${PROFILE_BADGE[accessProfile].label}`}
            aria-label={`Perfil de acesso ${PROFILE_BADGE[accessProfile].label}`}
          >
            {PROFILE_BADGE[accessProfile].label}
          </span>
        )}
        <NotificationBell />
        <Link
          href={profileHref}
          title="Editar meu perfil"
          aria-label="Meu Perfil"
          className="relative hidden size-8 shrink-0 overflow-hidden rounded-full transition-opacity hover:opacity-80 sm:flex"
        >
          {avatarSrc && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL curta na sessão ou rota /api/.../avatar
            <img
              src={avatarSrc}
              alt=""
              className="size-full object-cover"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-brand-primary text-xs font-semibold text-white">
              {initials}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
})

// ── Layout ──────────────────────────────────────────────────
interface Props {
  children: React.ReactNode
  sistemaNames: string[]
  integracoes?: IntegracaoSafeRecord[]
  hasSistemaComModulo?: boolean
  hasCenario?: boolean
  isAdmin?: boolean
  hasJiraConfigured?: boolean
  pendingDominioAvaliacao?: PendingDominioAvaliacaoDto | null
}

export default function LayoutClient({
  children,
  sistemaNames: sistemaNamesProp,
  integracoes: integracoesProp = [],
  hasSistemaComModulo: hasSistemaComModuloProp = false,
  hasCenario: hasCenarioProp = false,
  isAdmin: _isAdmin = false,
  hasJiraConfigured = false,
  pendingDominioAvaliacao = null,
}: Props) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(pendingDominioAvaliacao !== null)
  const pathname = usePathname()
  const { data: session } = useSession()
  const role: Role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const canAccessEquipeLancamentos = can(role, "equipe.lancamentos")
  const accessProfile: AccessProfile = (session?.user?.accessProfile as AccessProfile) ?? "QA"
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [assistenteOpen, setAssistenteOpen] = useState(false)
  const [isPending, startNavigationTransition] = useTransition()
  const [isSistemaChangePending, startSistemaChangeTransition] = useTransition()
  const [sistemaSwitchOverlay, setSistemaSwitchOverlay] = useState(false)
  const sistemaSwitchStartedAt = useRef(0)

  // ── Preserve last-known-good menu data ──────────────────────────────────────
  const [stableNames, setStableNames] = useState(sistemaNamesProp)
  const [stableIntegracoes, setStableIntegracoes] = useState(integracoesProp)
  const [stableHasSistemaComModulo, setStableHasSistemaComModulo] = useState(hasSistemaComModuloProp)
  const [stableHasCenario, setStableHasCenario] = useState(hasCenarioProp)

  useEffect(() => {
    if (sistemaNamesProp.length > 0) setStableNames(sistemaNamesProp)
    setStableIntegracoes(integracoesProp)
    setStableHasSistemaComModulo(hasSistemaComModuloProp)
    setStableHasCenario(hasCenarioProp)
  }, [sistemaNamesProp, integracoesProp, hasSistemaComModuloProp, hasCenarioProp])

  const sistemaNames = stableNames
  const integracoes = stableIntegracoes

  // ── Sistema selecionado ──────────────────────────────────────────────────────
  const [sistemaSelecionado, setSistemaSelecionado] = useState<string>(sistemaNames[0] ?? "")

  // On mount: apply localStorage preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && sistemaNames.includes(saved)) {
      setSistemaSelecionado(saved)
    } else if (sistemaNames[0]) {
      setSistemaSelecionado(sistemaNames[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep sistemaSelecionado valid when stableNames updates
  useEffect(() => {
    if (sistemaNames.length === 0) return
    setSistemaSelecionado((prev) => {
      if (prev && sistemaNames.includes(prev)) return prev
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && sistemaNames.includes(saved)) return saved
      return sistemaNames[0] ?? ""
    })
  }, [sistemaNames])

  // ── Computed flags ────────────────────────────────────────────────────────────
  // Painel, Suítes, Cenários: require sistema com módulo vinculado
  // Gerador, Assistente: require modelo de IA (integração)
  const hasActiveSistema = sistemaNames.length > 0
  const hasSistemaModulo = stableHasSistemaComModulo   // sistema + módulo vinculado
  const hasCenario = stableHasCenario

  // ── Theme ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = savedTheme ? savedTheme === "dark" : prefersDark
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }, [])

  // ── Redirect if no systems ────────────────────────────────────────────────────
  // Apenas para roles que dependem de Sistema (QA). Outros perfis não precisam.
  const needsSistema = can(role, "topbar.sistemaSelector")
  useEffect(() => {
    if (needsSistema && !hasActiveSistema && !pathname.startsWith("/configuracoes/sistemas")) {
      router.push("/configuracoes/sistemas")
    }
  }, [needsSistema, hasActiveSistema, pathname, router])

  // Administrador:QA sem módulos activos → redireciona para Configurações.
  const isAdminQA = role === "Administrador:QA"
  useEffect(() => {
    if (
      isAdminQA &&
      !hasSistemaModulo &&
      !pathname.startsWith("/configuracoes")
    ) {
      router.push("/configuracoes")
    }
  }, [isAdminQA, hasSistemaModulo, pathname, router])

  // Show loading screen only during the brief hydration gap where props arrived
  // but sistemaSelecionado hasn't been initialized yet.
  const isReady =
    !needsSistema ||
    !hasActiveSistema ||
    sistemaSelecionado !== ""

  function handleSistemaChange(value: string) {
    if (!value || value === sistemaSelecionado) return
    sistemaSwitchStartedAt.current = Date.now()
    setSistemaSwitchOverlay(true)
    startSistemaChangeTransition(() => {
      setSistemaSelecionado(value)
      localStorage.setItem(STORAGE_KEY, value)
    })
  }

  const MIN_SISTEMA_SWITCH_MS = 380
  useEffect(() => {
    if (!sistemaSwitchOverlay) return
    if (!isSistemaChangePending) {
      const elapsed = Date.now() - sistemaSwitchStartedAt.current
      const remaining = Math.max(0, MIN_SISTEMA_SWITCH_MS - elapsed)
      const id = window.setTimeout(() => setSistemaSwitchOverlay(false), remaining)
      return () => window.clearTimeout(id)
    }
  }, [sistemaSwitchOverlay, isSistemaChangePending])

  function handleToggleTheme() {
    const next = !isDark
    document.documentElement.classList.toggle("dark", next)
    setIsDark(next)
    localStorage.setItem(THEME_KEY, next ? "dark" : "light")
  }

  const handleNavigate = React.useCallback(
    (href: string) => {
      startNavigationTransition(() => {
        router.push(href)
      })
    },
    [router, startNavigationTransition],
  )

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-default">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <span className="text-sm text-text-secondary">Carregando…</span>
        </div>
      </div>
    )
  }

  return (
    <SistemaContext.Provider value={{ sistemaSelecionado, setSistemaSelecionado: handleSistemaChange }}>
      {pendingDominioAvaliacao ? (
        <DominioResponderSheet
          open={drawerOpen}
          onOpenChange={(v) => {
            setDrawerOpen(v)
            if (!v) router.refresh()
          }}
          avaliacaoId={pendingDominioAvaliacao.id}
          configSnapshot={pendingDominioAvaliacao.configSnapshot}
          respostasAnteriores={pendingDominioAvaliacao.respostasAnteriores}
          onSubmit={completarDominioAvaliacao}
        />
      ) : null}
      <div className="flex h-screen overflow-hidden">
        <Suspense fallback={null}>
          <Sidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            isDark={isDark}
            assistenteOpen={assistenteOpen}
            onAssistenteOpen={() => setAssistenteOpen(true)}
            hasSistemaModulo={hasSistemaModulo}
            hasCenario={hasCenario}
            hasIntegracoes={integracoes.length > 0}
            hasJiraConfigured={hasJiraConfigured}
            role={role}
            canAccessEquipeLancamentos={canAccessEquipeLancamentos}
            onNavigate={handleNavigate}
          />
        </Suspense>
        <AssistenteDrawer open={assistenteOpen} onOpenChange={setAssistenteOpen} integracoes={integracoes} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Suspense fallback={null}>
            <Topbar
              collapsed={collapsed}
              onToggleDesktop={() => setCollapsed((v) => !v)}
              onToggleMobile={() => setMobileOpen((v) => !v)}
              sistemaNames={sistemaNames}
              sistemaSelecionado={sistemaSelecionado}
              onSistemaChange={handleSistemaChange}
              sistemaSelectPending={sistemaSwitchOverlay || isSistemaChangePending}
              isDark={isDark}
              onToggleTheme={handleToggleTheme}
              role={role}
              accessProfile={accessProfile}
            />
          </Suspense>
          <main className="relative flex-1 overflow-auto bg-surface-default p-4 lg:p-6">
            {isPending && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface-default">
                <SectionSpinner label="Carregando…" minHeight="min-h-0" />
              </div>
            )}
            {sistemaSwitchOverlay && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-default/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                  <span className="text-sm text-text-secondary">A trocar de sistema…</span>
                </div>
              </div>
            )}
            {(!needsSistema || hasActiveSistema || pathname.startsWith("/configuracoes/sistemas")) ? children : null}
            <BackToTop />
          </main>
        </div>
      </div>
    </SistemaContext.Provider>
  )
}
