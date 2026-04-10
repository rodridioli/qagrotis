"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, FileText, Rocket, BookOpen,
  Settings, Bot, LogOut, ChevronLeft,
  ChevronRight, Menu, Moon, Sun, Sparkles, History,
} from "lucide-react"
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
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { SistemaContext } from "@/lib/modulo-context"
import { AssistenteDrawer } from "@/components/qagrotis/AssistenteDrawer"
import type { IntegracaoRecord } from "@/lib/actions/integracoes"

const STORAGE_KEY = "qa_sistema_selecionado"
const THEME_KEY = "qa_theme"

// Rotas que requerem sistema ativo + módulo ativo para serem acessíveis
const REQUIRES_SISTEMA_MODULO = new Set(["/dashboard", "/cenarios", "/gerador", "/assistente", "/atualizacoes"])
// Suítes requer também pelo menos 1 cenário no sistema selecionado
const REQUIRES_CENARIO = new Set(["/suites"])

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Painel",           alwaysEnabled: false },
  { href: "/suites",        icon: Rocket,          label: "Suítes",           alwaysEnabled: false },
  { href: "/cenarios",      icon: FileText,        label: "Cenários",         alwaysEnabled: false },
  { href: "/gerador",       icon: Sparkles,        label: "Gerador",          alwaysEnabled: false },
  { href: "/documentos",    icon: BookOpen,        label: "Documentos",       alwaysEnabled: false },
  { href: "/assistente",    icon: Bot,             label: "Assistente de IA", alwaysEnabled: false },
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
  hasActiveSistema: boolean
  hasSistemaModulo: boolean
  hasSistemaCenario: boolean
  hasIntegracoes: boolean
}

function Sidebar({ collapsed, mobileOpen, onCloseMobile, isDark, assistenteOpen, onAssistenteOpen, hasActiveSistema, hasSistemaModulo, hasSistemaCenario, hasIntegracoes }: SidebarProps) {
  const pathname = usePathname()
  const expanded = !collapsed

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
          <Link href="/dashboard" className="flex items-center">
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
              // Compute disabled state dynamically based on system/module/cenario availability
              let disabled = false
              if (!alwaysEnabled) {
                if (!hasActiveSistema) {
                  disabled = true
                } else if (REQUIRES_CENARIO.has(href)) {
                  disabled = !hasSistemaCenario
                } else if (REQUIRES_SISTEMA_MODULO.has(href)) {
                  disabled = !hasSistemaModulo
                } else if (href === "/documentos") {
                  disabled = true // always disabled
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
                "group flex items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-150",
                collapsed ? "lg:justify-center" : "",
                isActive
                  ? "bg-brand-primary"
                  : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary hover:translate-x-0.5"
              )
              const itemStyle = isActive ? { color: "#ffffff" } : undefined
              const itemChildren = (
                <>
                  <Icon className="size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                  {showLabel && <span className="truncate">{label}</span>}
                </>
              )

              // "Assistente de IA" is a drawer trigger, not a route link
              if (isAssistente) {
                if (!hasIntegracoes) return null

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
                    <TooltipTrigger render={<Link href={href} style={itemStyle} className={itemClassName} />}>
                      {itemChildren}
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                )
              }
              return (
                <Link key={href} href={href} style={itemStyle} className={itemClassName}>
                  {itemChildren}
                </Link>
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
                      className="flex w-full items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-destructive transition-all duration-150 hover:bg-neutral-grey-100 lg:justify-center"
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
                className="flex w-full items-center gap-3 rounded px-2.5 py-2 text-sm font-medium text-destructive transition-all duration-150 hover:bg-neutral-grey-100 hover:translate-x-0.5"
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
}

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

function Topbar({
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

  const qaUser = MOCK_USERS.find((u) => u.email === session?.user?.email)
  const initials = qaUser
    ? qaUser.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : (session?.user?.name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase() ?? "QA")
  const profileHref = qaUser ? `/configuracoes/usuarios/${qaUser.id}/editar` : "/configuracoes/usuarios"

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
          className="hidden size-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold transition-opacity hover:opacity-80 sm:flex"
          style={{ color: "#ffffff" }}
        >
          {initials}
        </Link>
      </div>
    </header>
  )
}

// ── Layout ──────────────────────────────────────────────────
interface Props {
  children: React.ReactNode
  sistemaNames: string[]
  integracoes?: IntegracaoRecord[]
  sistemaComModulo?: string[]
  sistemaComCenario?: string[]
}

export default function LayoutClient({
  children,
  sistemaNames,
  integracoes = [],
  sistemaComModulo = [],
  sistemaComCenario = [],
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sistemaSelecionado, setSistemaSelecionado] = useState("")
  const [isDark, setIsDark] = useState(false)
  const [assistenteOpen, setAssistenteOpen] = useState(false)

  // Computed flags based on selected sistema
  const hasActiveSistema = sistemaNames.length > 0
  const hasSistemaModulo = hasActiveSistema && sistemaComModulo.includes(sistemaSelecionado)
  const hasSistemaCenario = hasActiveSistema && sistemaComCenario.includes(sistemaSelecionado)

  useEffect(() => {
    if (sistemaNames.length === 0) {
      setSistemaSelecionado("")
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && sistemaNames.includes(saved)) {
      setSistemaSelecionado(saved)
    } else {
      setSistemaSelecionado(sistemaNames[0])
    }
  }, [sistemaNames])

  // Redirect to /configuracoes/sistemas when there are no active systems
  useEffect(() => {
    if (!hasActiveSistema && !pathname.startsWith("/configuracoes/sistemas")) {
      router.push("/configuracoes/sistemas")
    }
  }, [hasActiveSistema, pathname, router])

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY)
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const dark = savedTheme ? savedTheme === "dark" : prefersDark
    setIsDark(dark)
    document.documentElement.classList.toggle("dark", dark)
  }, [])

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

  return (
    <SistemaContext.Provider value={{ sistemaSelecionado, setSistemaSelecionado: handleSistemaChange }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          isDark={isDark}
          assistenteOpen={assistenteOpen}
          onAssistenteOpen={() => setAssistenteOpen(true)}
          hasActiveSistema={hasActiveSistema}
          hasSistemaModulo={hasSistemaModulo}
          hasSistemaCenario={hasSistemaCenario}
          hasIntegracoes={integracoes.length > 0}
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
          <main className="flex-1 overflow-auto bg-surface-default p-4 lg:p-6">
            {(hasActiveSistema || pathname.startsWith("/configuracoes/sistemas")) ? children : null}
          </main>
        </div>
      </div>
    </SistemaContext.Provider>
  )
}
