"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Check,
  ChevronRight,
  Clock4,
  FileText,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  Rocket,
  Sparkles,
  Target,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/core/utils"
import { can } from "@/core/rbac/policy"
import type { Role } from "@/core/rbac/policy"

interface TrabalhoItem {
  id: string
  label: string
  Icon: React.ElementType
  href: string
  disabled?: boolean
}

function getItems(
  role: Role,
  hasIntegracoes: boolean,
  hasJiraConfigured: boolean,
): TrabalhoItem[] {
  const registrosEquipe: TrabalhoItem  = { id: "registros-equipe",      label: "Registros", Icon: Check,          href: "/equipe?tab=lancamentos" }
  const registrosIndividual: TrabalhoItem = { id: "registros-individual", label: "Registros", Icon: Check,          href: "/individual/lancamentos" }
  const clockwork: TrabalhoItem        = { id: "clockwork",              label: "Clockwork", Icon: Clock4,         href: "/equipe?tab=clockwork" }
  const kanban: TrabalhoItem           = { id: "kanban",                 label: "Kanban",    Icon: KanbanSquare,   href: "/kanban" }
  const painel: TrabalhoItem           = { id: "painel",                 label: "Painel",    Icon: LayoutDashboard, href: "/dashboard" }
  const suites: TrabalhoItem           = { id: "suites",                 label: "Suítes",    Icon: Rocket,         href: "/suites" }
  const cenarios: TrabalhoItem         = { id: "cenarios",               label: "Cenários",  Icon: FileText,       href: "/cenarios" }
  const gerador: TrabalhoItem          = { id: "gerador",                label: "Gerador",   Icon: Sparkles,       href: "/gerador" }
  const okr: TrabalhoItem              = { id: "okr",                    label: "OKR",       Icon: Target,         href: "/equipe?tab=metas", disabled: true }

  const showGerador = hasIntegracoes && hasJiraConfigured

  switch (role) {
    case "Padrão:UX":
      return [kanban, registrosIndividual, clockwork, okr]
    case "Administrador:UX":
      return [kanban, registrosEquipe, clockwork, okr]
    case "Padrão:TW":
      return [registrosIndividual, clockwork, okr]
    case "Administrador:TW":
      return [registrosEquipe, clockwork, okr]
    case "Padrão:QA": {
      const items: TrabalhoItem[] = [painel, registrosIndividual, suites, cenarios]
      if (showGerador) items.push(gerador)
      items.push(okr)
      return items
    }
    case "Administrador:QA": {
      const items: TrabalhoItem[] = [painel, registrosEquipe, clockwork, suites, cenarios]
      if (showGerador) items.push(gerador)
      items.push(okr)
      return items
    }
    default:
      return []
  }
}

function matchesHref(
  href: string,
  pathname: string,
  tab: string | null,
): boolean {
  if (href === "/equipe?tab=lancamentos") return pathname.startsWith("/equipe") && tab === "lancamentos"
  if (href === "/equipe?tab=clockwork")   return pathname.startsWith("/equipe") && tab === "clockwork"
  if (href === "/equipe?tab=metas")       return pathname.startsWith("/equipe") && tab === "metas"
  return pathname.startsWith(href)
}

export interface TrabalhoSidebarNavGroupProps {
  role: Role
  collapsed: boolean
  onNavigate?: (href: string) => void
  hasIntegracoes: boolean
  hasJiraConfigured: boolean
  hasSistemaModulo: boolean
  hasCenario: boolean
}

export function TrabalhoSidebarNavGroup({
  role,
  collapsed,
  onNavigate,
  hasIntegracoes,
  hasJiraConfigured,
  hasSistemaModulo,
  hasCenario,
}: TrabalhoSidebarNavGroupProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab")

  const needsSistema = can(role, "topbar.sistemaSelector")

  const items = React.useMemo(
    () => getItems(role, hasIntegracoes, hasJiraConfigured),
    [role, hasIntegracoes, hasJiraConfigured],
  )

  const [open, setOpen] = React.useState(false)
  const prevPathRef = React.useRef("")

  const parentActive = items.some(
    (item) => !item.disabled && matchesHref(item.href, pathname, tab),
  )

  React.useEffect(() => {
    const now = items.some((item) => !item.disabled && matchesHref(item.href, pathname, tab))
    const was = prevPathRef.current
      ? items.some((item) => !item.disabled && matchesHref(item.href, prevPathRef.current, tab))
      : false
    prevPathRef.current = pathname
    if (now && !was) setOpen(true)
    if (!now && was) setOpen(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tab])

  function go(href: string) {
    if (onNavigate) onNavigate(href)
    else router.push(href)
  }

  function getContextDisabled(item: TrabalhoItem): boolean {
    if (item.disabled) return true
    if (!needsSistema) return false
    if (item.id === "painel" || item.id === "cenarios") return !hasSistemaModulo
    if (item.id === "suites") return !hasSistemaModulo || !hasCenario || !hasJiraConfigured
    return false
  }

  const firstNavigableHref = items.find((i) => !getContextDisabled(i))?.href ?? "/dashboard"

  if (collapsed) {
    const itemClassName = cn(
      "group flex cursor-pointer items-center gap-3 rounded px-2.5 py-2 text-sm font-medium transition-all duration-150 lg:justify-center",
      parentActive
        ? "bg-brand-primary text-white"
        : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary hover:translate-x-0.5",
    )
    const itemStyle = parentActive ? { color: "#ffffff" } : undefined
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              style={itemStyle}
              className={cn(itemClassName, "w-full cursor-pointer")}
              onClick={() => go(firstNavigableHref)}
            />
          }
        >
          <Layers
            className={cn(
              "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
              parentActive ? "text-white" : "",
            )}
          />
        </TooltipTrigger>
        <TooltipContent>Trabalho</TooltipContent>
      </Tooltip>
    )
  }

  const subItemClassName = (active: boolean) =>
    cn(
      "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-all duration-150",
      active
        ? "bg-brand-primary text-white"
        : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary",
    )

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded px-1 py-0.5",
          parentActive ? "bg-brand-primary/10" : "",
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="trabalho-sidebar-subnav"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-text-primary",
            parentActive && "text-brand-primary",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronRight
            className={cn("size-4 transition-transform duration-200", open && "rotate-90")}
            aria-hidden
          />
          <span className="sr-only">
            {open ? "Recolher submenu Trabalho" : "Expandir submenu Trabalho"}
          </span>
        </button>

        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-all duration-150",
            parentActive && !open
              ? "bg-brand-primary text-white"
              : parentActive && open
                ? "text-brand-primary"
                : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary",
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <Layers className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">Trabalho</span>
        </button>
      </div>

      {open ? (
        <nav
          id="trabalho-sidebar-subnav"
          aria-label="Secções Trabalho"
          className="ml-2 border-l border-border-default pl-2"
        >
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const { id, label, Icon, href } = item
              const contextDisabled = getContextDisabled(item)

              if (contextDisabled) {
                return (
                  <li key={id}>
                    <span
                      className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium opacity-40"
                      aria-disabled="true"
                    >
                      <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                      <span className="truncate text-text-secondary">{label}</span>
                    </span>
                  </li>
                )
              }

              const active = matchesHref(href, pathname, tab)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={subItemClassName(active)}
                    style={active ? { color: "#ffffff" } : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(href)}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-white" : "")} aria-hidden />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
