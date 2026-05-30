"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, Users } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/core/utils"
import { EQUIPE_NAV_ENTRIES } from "@/features/equipe/components/equipeNavEntries"

export interface EquipeSidebarNavGroupProps {
  collapsed: boolean
  onNavigate?: (href: string) => void
  canAccessLancamentos?: boolean
  hideClockwork?: boolean
  hideOkr?: boolean
}

export function EquipeSidebarNavGroup({ collapsed, onNavigate, canAccessLancamentos = false, hideClockwork = false, hideOkr = false }: EquipeSidebarNavGroupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [open, setOpen] = React.useState(false)
  const prevPath = React.useRef("")

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    const isLancamentosTopLevel = tab === "lancamentos" && !canAccessLancamentos
    const isClockworkTopLevel = tab === "clockwork" && hideClockwork
    const now = pathname.startsWith("/equipe") && !isLancamentosTopLevel && !isClockworkTopLevel
    const was = prevPath.current.startsWith("/equipe")
    prevPath.current = pathname
    if (now && !was) setOpen(true)
    if (!now && was) setOpen(false)
  }, [pathname, searchParams, canAccessLancamentos, hideClockwork])

  const activeTabId = searchParams.get("tab") ?? "chapters"
  const parentActive = pathname.startsWith("/equipe")
    && !(activeTabId === "lancamentos" && !canAccessLancamentos)
    && !(activeTabId === "clockwork" && hideClockwork)

  function go(href: string) {
    if (onNavigate) onNavigate(href)
    else router.push(href)
  }

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
              onClick={() => go("/equipe")}
            />
          }
        >
          <Users className={cn("size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110", parentActive ? "text-white" : "")} />
        </TooltipTrigger>
        <TooltipContent>Equipe</TooltipContent>
      </Tooltip>
    )
  }

  const itemClassName = (active: boolean) =>
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
          aria-controls="equipe-sidebar-subnav"
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
          <span className="sr-only">{open ? "Recolher submenu Equipe" : "Expandir submenu Equipe"}</span>
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
          <Users className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">Equipe</span>
        </button>
      </div>

      {open ? (
        <nav id="equipe-sidebar-subnav" aria-label="Secções Equipe" className="ml-2 border-l border-border-default pl-2">
          <ul className="flex flex-col gap-0.5">
            {EQUIPE_NAV_ENTRIES.filter((e) => {
              if (e.id === "lancamentos" && !canAccessLancamentos) return false
              if (e.id === "clockwork" && hideClockwork) return false
              if (e.id === "metas" && hideOkr) return false
              return true
            }).map(({ id, label, icon: Icon }) => {
              const href = `/equipe?tab=${id}`
              const active = parentActive && activeTabId === id
              if (id === "metas") {
                return (
                  <li key={id}>
                    <span className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium opacity-40">
                      <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                      <span className="truncate text-text-secondary">{label}</span>
                    </span>
                  </li>
                )
              }
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={itemClassName(active)}
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
