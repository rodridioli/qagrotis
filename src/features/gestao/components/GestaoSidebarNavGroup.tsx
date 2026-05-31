"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Briefcase, Check, ChevronRight, Clock4, KanbanSquare, Target } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/core/utils"

const GESTAO_SUBITEMS = [
  { id: "kanban",      label: "Kanban",    Icon: KanbanSquare, href: "/kanban",                 disabled: false },
  { id: "lancamentos", label: "Registros", Icon: Check,        href: "/equipe?tab=lancamentos", disabled: false },
  { id: "clockwork",   label: "Clockwork", Icon: Clock4,       href: "/equipe?tab=clockwork",   disabled: false },
  { id: "okr",         label: "OKR",       Icon: Target,       href: "/equipe?tab=metas",       disabled: false },
] as const

export interface GestaoSidebarNavGroupProps {
  collapsed: boolean
  onNavigate?: (href: string) => void
}

export function GestaoSidebarNavGroup({ collapsed, onNavigate }: GestaoSidebarNavGroupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const isGestaoActive = React.useCallback(
    (path: string, params: ReturnType<typeof useSearchParams>) => {
      const tab = params.get("tab")
      return (
        path === "/kanban" ||
        (path.startsWith("/equipe") && (tab === "lancamentos" || tab === "clockwork" || tab === "metas"))
      )
    },
    [],
  )

  const [open, setOpen] = React.useState(() => isGestaoActive(pathname, searchParams))
  const prevGestaoActive = React.useRef(isGestaoActive(pathname, searchParams))

  React.useEffect(() => {
    const now = isGestaoActive(pathname, searchParams)
    const was = prevGestaoActive.current
    prevGestaoActive.current = now
    if (now && !was) setOpen(true)
    if (!now && was) setOpen(false)
  }, [pathname, searchParams, isGestaoActive])

  const parentActive = isGestaoActive(pathname, searchParams)

  const tab = searchParams.get("tab")
  const activeItemId =
    pathname === "/kanban"
      ? "kanban"
      : pathname.startsWith("/equipe") && tab === "lancamentos"
        ? "lancamentos"
        : pathname.startsWith("/equipe") && tab === "clockwork"
          ? "clockwork"
          : pathname.startsWith("/equipe") && tab === "metas"
            ? "okr"
            : null

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
              onClick={() => go("/kanban")}
            />
          }
        >
          <Briefcase
            className={cn(
              "size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110",
              parentActive ? "text-white" : "",
            )}
          />
        </TooltipTrigger>
        <TooltipContent>Gestão</TooltipContent>
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
          aria-controls="gestao-sidebar-subnav"
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
            {open ? "Recolher submenu Gestão" : "Expandir submenu Gestão"}
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
          <Briefcase className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">Gestão</span>
        </button>
      </div>

      {open ? (
        <nav
          id="gestao-sidebar-subnav"
          aria-label="Secções Gestão"
          className="ml-2 border-l border-border-default pl-2"
        >
          <ul className="flex flex-col gap-0.5">
            {GESTAO_SUBITEMS.map(({ id, label, Icon, href, disabled }) => {
              if (disabled) {
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
              const active = activeItemId === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={subItemClassName(active)}
                    style={active ? { color: "#ffffff" } : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(href)}
                  >
                    <Icon
                      className={cn("size-4 shrink-0", active ? "text-white" : "")}
                      aria-hidden
                    />
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
