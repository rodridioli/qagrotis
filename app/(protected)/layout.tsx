"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Rocket,
  BookOpen,
  Settings,
  User,
  LogOut,
  House,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Painel de Métricas" },
  { href: "/cenarios", icon: FileText, label: "Cenários" },
  { href: "/suites", icon: Rocket, label: "Suítes" },
  { href: "/documentos", icon: BookOpen, label: "Documentos" },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
]

const TITLE_MAP: Record<string, string> = {
  "/dashboard": "Painel de Métricas",
  "/cenarios": "Cenários",
  "/suites": "Suítes",
  "/documentos": "Documentos",
  "/configuracoes": "Configurações",
  "/assistente": "Assistente IA",
}

function getTitle(pathname: string): string {
  for (const [key, value] of Object.entries(TITLE_MAP)) {
    if (pathname.startsWith(key)) return value
  }
  return "QAgrotis"
}

function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-14 flex-col items-center border-r border-border-default bg-surface-card py-3">
      <Link
        href="/dashboard"
        className="mb-4 flex size-9 items-center justify-center rounded-lg text-text-secondary hover:bg-neutral-grey-100"
        title="Início"
      >
        <House className="size-5" />
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-brand-primary text-white"
                  : "text-text-secondary hover:bg-neutral-grey-100"
              )}
            >
              <Icon className="size-5" />
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col items-center gap-1 border-t border-border-default pt-2">
        <Link
          href="/assistente"
          title="Assistente de IA"
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-colors",
            pathname.startsWith("/assistente")
              ? "bg-brand-primary text-white"
              : "text-text-secondary hover:bg-neutral-grey-100"
          )}
        >
          <User className="size-5" />
        </Link>
        <Link
          href="/api/auth/signout"
          title="Sair"
          className="flex size-9 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-neutral-grey-100"
        >
          <LogOut className="size-5" />
        </Link>
      </div>
    </aside>
  )
}

function Topbar() {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-default bg-surface-card px-6">
      <h1 className="text-base font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-input px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          Sistema: Gerencial
          <ChevronDown className="size-4" />
        </button>
        <div className="flex size-8 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
          QA
        </div>
      </div>
    </header>
  )
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto bg-surface-default p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
