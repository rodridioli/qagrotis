"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FileText, Rocket, BookOpen,
  Settings, Bot, LogOut, ChevronDown, ChevronLeft,
  ChevronRight, Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"
import { QAgrotisIcon } from "@/components/qagrotis/QAgrotisIcon"
import { signOut, useSession } from "next-auth/react"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Painel de Métricas", disabled: false },
  { href: "/cenarios",      icon: FileText,        label: "Cenários",           disabled: false },
  { href: "/suites",        icon: Rocket,          label: "Suítes",             disabled: false },
  { href: "/documentos",    icon: BookOpen,        label: "Documentos",         disabled: true  },
  { href: "/configuracoes", icon: Settings,        label: "Configurações",      disabled: false },
  { href: "/assistente",    icon: Bot,             label: "Assistente de IA",   disabled: true  },
]

const TITLE_MAP: Record<string, string> = {
  "/dashboard":     "Painel de Métricas",
  "/cenarios":      "Cenários",
  "/suites":        "Suítes",
  "/documentos":    "Documentos",
  "/configuracoes": "Configurações",
  "/assistente":    "Assistente de IA",
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
}

function Sidebar({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const expanded = !collapsed

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          // Base
          "flex h-screen flex-col border-r border-border-default bg-surface-card transition-all duration-200",
          // Mobile: fixed overlay drawer
          "fixed inset-y-0 left-0 z-50 w-52",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: inline, collapsible
          "lg:relative lg:translate-x-0",
          collapsed ? "lg:w-14" : "lg:w-52"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-14 shrink-0 items-center border-b border-border-default",
          collapsed ? "lg:justify-center lg:px-0 px-4" : "px-4"
        )}>
          <Link href="/dashboard" className="flex items-center">
            {collapsed
              ? <span className="hidden lg:block"><QAgrotisIcon size={20} className="text-brand-primary" /></span>
              : null}
            <span className={cn(collapsed ? "lg:hidden" : "")}>
              <QAgrotisLogo height={26} />
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map(({ href, icon: Icon, label, disabled }) => {
            const isActive = !disabled && pathname.startsWith(href)
            const showLabel = !collapsed

            if (disabled) {
              return (
                <span
                  key={href}
                  title={!showLabel ? label : undefined}
                  className={cn(
                    "flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium opacity-40",
                    collapsed ? "lg:justify-center" : ""
                  )}
                >
                  <Icon className="size-4.5 shrink-0 text-text-secondary" />
                  {showLabel && <span className="truncate text-text-secondary">{label}</span>}
                </span>
              )
            }

            return (
              <Link
                key={href}
                href={href}
                title={!showLabel ? label : undefined}
                style={isActive ? { color: "#ffffff" } : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  collapsed ? "lg:justify-center" : "",
                  isActive
                    ? "bg-brand-primary"
                    : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary"
                )}
              >
                <Icon className="size-4.5 shrink-0" />
                {showLabel && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col gap-0.5 border-t border-border-default px-2 py-3">
          <button
            type="button"
            title={collapsed ? "Sair do Sistema" : undefined}
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-neutral-grey-100",
              collapsed ? "lg:justify-center" : ""
            )}
          >
            <LogOut className="size-4.5 shrink-0" />
            {!collapsed && <span className="truncate">Sair do Sistema</span>}
          </button>
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
}

function Topbar({ collapsed, onToggleDesktop, onToggleMobile }: TopbarProps) {
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
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onToggleMobile}
          aria-label="Abrir menu"
          className="flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100 lg:hidden"
        >
          <Menu className="size-4" />
        </button>
        {/* Desktop chevron */}
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
          className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-input px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <span className="hidden text-sm text-text-secondary sm:inline">Sistema:</span>
          <span className="font-medium text-text-primary">Gerencial</span>
          <ChevronDown className="size-4 text-text-secondary" />
        </button>
        <Link
          href={profileHref}
          title="Editar meu perfil"
          className="flex size-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: "#ffffff" }}
        >
          {initials}
        </Link>
      </div>
    </header>
  )
}

// ── Layout ──────────────────────────────────────────────────
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          collapsed={collapsed}
          onToggleDesktop={() => setCollapsed((v) => !v)}
          onToggleMobile={() => setMobileOpen((v) => !v)}
        />
        <main className="flex-1 overflow-auto bg-surface-default p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
