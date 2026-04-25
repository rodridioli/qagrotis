"use client"

import React, { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, FileText, Rocket, BookOpen,
  Settings, Bot, LogOut, ChevronLeft,
  ChevronRight, Menu, Moon, Sun, Sparkles, History, Users,
} from "lucide-react"
import { CommandBarProvider, useCommandBarContext } from "@/contexts/CommandBarContext"
import { CommandBar } from "@/components/qagrotis/CommandBar"
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
import { cn } from "@/lib/utils"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"
import { QAgrotisIcon } from "@/components/qagrotis/QAgrotisIcon"
import { signOut, useSession } from "next-auth/react"
import { SistemaContext } from "@/lib/modulo-context"
import { AssistenteDrawer } from "@/components/qagrotis/AssistenteDrawer"
import type { IntegracaoRecord } from "@/lib/actions/integracoes"

const STORAGE_KEY = "qa_sistema_selecionado"
const THEME_KEY = "qa_theme"

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Painel",           alwaysEnabled: false },
  { href: "/suites",        icon: Rocket,          label: "Suítes",           alwaysEnabled: false },
  { href: "/cenarios",      icon: FileText,        label: "Cenários",         alwaysEnabled: false },
  { href: "/gerador",       icon: Sparkles,        label: "Gerador",          alwaysEnabled: false },
  { href: "/documentos",    icon: BookOpen,        label: "Documentos",       alwaysEnabled: false },
  { href: "/assistente",    icon: Bot,             label: "Assistente de IA", alwaysEnabled: false },
  { href: "/equipe",        icon: Users,           label: "Equipe",           alwaysEnabled: false },
  { href: "/configuracoes", icon: Settings,        label: "Configurações",    alwaysEnabled: true  },
  { href: "/atualizacoes",  icon: History,         label: "Atualizações",     alwaysEnabled: false },
]

const TITLE_MAP: Record<string, string> = {
  "/dashboard":     "Painel",
  "/cenarios":      "Cenários",
  "/gerador":       "Gerador",
  "/suites":        "Suítes",
  "/documentos":    "Documentos",
  "/configuracoes": "Configurações",
  "/assistente":    "Assistente de IA",
  "/atualizacoes":  "Atualizações",
  "/equipe":        "Equipe",
}

function getTitle(pathname: string): string {
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
  hasIntegracoes: boolean
  /** Navegação com transição (mantém overlay de carregamento até a rota resolver). */
  onNavigate?: (href: string) => void
}

const Sidebar = React.memo(function Sidebar({ collapsed, mobileOpen, onCloseMobile, isDark, assistenteOpen, onAssistenteOpen, hasSistemaModulo, hasIntegracoes, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
            {NAV_ITEMS.map(({ href, icon: Icon, label, alwaysEnabled }) => {
              // Compute disabled state dynamically based on system/module/AI model availability
              let disabled = false
              if (!alwaysEnabled) {
                if (href === "/documentos") {
                  disabled = true
                } else if (href === "/gerador" || href === "/assistente") {
                  // Gerador + Assistente: require sistema+módulo AND modelo de IA
                  disabled = !hasSistemaModulo || !hasIntegracoes
                } else if (href === "/dashboard" || href === "/suites" || href === "/cenarios" || href === "/equipe") {
                  // Painel, Suítes, Cenários, Equipe: require sistema with módulo linked
                  disabled = !hasSistemaModulo
                }
              }

              const isAssistente = href === "/assistente"
              const isActive = isAssistente
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
  isDark: boolean
  onToggleTheme: () => void
}

const Topbar = React.memo(function Topbar({
  collapsed,
  onToggleDesktop,
  onToggleMobile,
  sistemaNames,
  sistemaSelecionado,
  onSistemaChange,
  isDark,
  onToggleTheme,
}: TopbarProps) {
  const pathname = usePathname()
  const title = getTitle(pathname)
  const { data: session } = useSession()
  const { open: openCommandBar } = useCommandBarContext()
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
  const internalId = sessionForUi?.user?.id
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
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 lg:hidden"
        >
          <Menu className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggleDesktop}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 lg:flex"
        >
          {collapsed
            ? <ChevronRight className="size-4" />
            : <ChevronLeft className="size-4" />
          }
        </button>
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openCommandBar}
          aria-label="Abrir barra de comandos (Ctrl+K)"
          className="hidden items-center gap-1.5 rounded-md border border-border-default bg-surface-input px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary sm:flex"
        >
          <Sparkles className="size-3 text-brand-primary" aria-hidden="true" />
          <span>Ctrl+K</span>
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary"
        >
          {isDark
            ? <Sun className="size-4" />
            : <Moon className="size-4" />
          }
        </button>
        {sistemaNames.length > 0 ? (
          <Select value={sistemaSelecionado} onValueChange={(v) => onSistemaChange(v ?? "")}>
            <SelectTrigger className="h-auto flex w-20 max-w-20 gap-1 overflow-hidden px-2 py-1.5 text-xs sm:w-auto sm:min-w-32 sm:max-w-56 sm:gap-1.5 sm:px-3 sm:text-sm">
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
        )}
        <Link
          href={profileHref}
          title="Editar meu perfil"
          aria-label="Meu Perfil"
          className="hidden size-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white transition-opacity hover:opacity-80 sm:flex"
        >
          {initials}
        </Link>
      </div>
    </header>
  )
})

// ── Layout ──────────────────────────────────────────────────
interface Props {
  children: React.ReactNode
  sistemaNames: string[]
  integracoes?: IntegracaoRecord[]
  hasSistemaComModulo?: boolean
}

export default function LayoutClient({
  children,
  sistemaNames: sistemaNamesProp,
  integracoes: integracoesProp = [],
  hasSistemaComModulo: hasSistemaComModuloProp = false,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [assistenteOpen, setAssistenteOpen] = useState(false)
  const [isPending, startNavigationTransition] = useTransition()

  // ── Preserve last-known-good menu data ──────────────────────────────────────
  const [stableNames, setStableNames] = useState(sistemaNamesProp)
  const [stableIntegracoes, setStableIntegracoes] = useState(integracoesProp)
  const [stableHasSistemaComModulo, setStableHasSistemaComModulo] = useState(hasSistemaComModuloProp)

  useEffect(() => {
    if (sistemaNamesProp.length > 0) setStableNames(sistemaNamesProp)
    setStableIntegracoes(integracoesProp)
    setStableHasSistemaComModulo(hasSistemaComModuloProp)
  }, [sistemaNamesProp, integracoesProp, hasSistemaComModuloProp])

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

  // ── Theme ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = savedTheme ? savedTheme === "dark" : prefersDark
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }, [])

  // ── Redirect if no systems ────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasActiveSistema && !pathname.startsWith("/configuracoes/sistemas")) {
      router.push("/configuracoes/sistemas")
    }
  }, [hasActiveSistema, pathname, router])

  // Show loading screen only during the brief hydration gap where props arrived
  // but sistemaSelecionado hasn't been initialized yet.
  const isReady =
    !hasActiveSistema ||
    sistemaSelecionado !== ""

  function handleSistemaChange(value: string) {
    setSistemaSelecionado(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

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
          <span className="text-sm text-text-secondary">Carregando...</span>
        </div>
      </div>
    )
  }

  return (
    <CommandBarProvider>
    <SistemaContext.Provider value={{ sistemaSelecionado, setSistemaSelecionado: handleSistemaChange }}>
      <CommandBar />
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          isDark={isDark}
          assistenteOpen={assistenteOpen}
          onAssistenteOpen={() => setAssistenteOpen(true)}
          hasSistemaModulo={hasSistemaModulo}
          hasIntegracoes={integracoes.length > 0}
          onNavigate={handleNavigate}
        />
        <AssistenteDrawer open={assistenteOpen} onOpenChange={setAssistenteOpen} integracoes={integracoes} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            collapsed={collapsed}
            onToggleDesktop={() => setCollapsed((v) => !v)}
            onToggleMobile={() => setMobileOpen((v) => !v)}
            sistemaNames={sistemaNames}
            sistemaSelecionado={sistemaSelecionado}
            onSistemaChange={handleSistemaChange}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
          />
          <main className="relative flex-1 overflow-auto bg-surface-default p-4 lg:p-6">
            {isPending && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface-default/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                  <span className="text-sm text-text-secondary">Carregando...</span>
                </div>
              </div>
            )}
            {(hasActiveSistema || pathname.startsWith("/configuracoes/sistemas")) ? children : null}
          </main>
        </div>
      </div>
    </SistemaContext.Provider>
    </CommandBarProvider>
  )
}
