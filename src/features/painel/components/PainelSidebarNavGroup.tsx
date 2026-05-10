"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BarChart3, CheckSquare, ChevronRight, Code2, LayoutDashboard, Palette } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/core/utils"

const PAINEL_SUBITEMS = [
  { id: "MGR", label: "MGR", Icon: BarChart3 },
  { id: "QA",  label: "QA",  Icon: CheckSquare },
  { id: "UX",  label: "UX",  Icon: Palette },
  { id: "TW",  label: "TW",  Icon: Code2 },
] as const

export interface PainelSidebarNavGroupProps {
  collapsed: boolean
  onNavigate?: (href: string) => void
}

export function PainelSidebarNavGroup({ collapsed, onNavigate }: PainelSidebarNavGroupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [open, setOpen] = React.useState(false)
  const prevPath = React.useRef("")

  React.useEffect(() => {
    const now = pathname.startsWith("/dashboard")
    const was = prevPath.current.startsWith("/dashboard")
    prevPath.current = pathname
    if (now && !was) setOpen(true)
    if (!now && was) setOpen(false)
  }, [pathname])

  const activePerfil = searchParams.get("perfil") ?? ""
  const parentActive = pathname.startsWith("/dashboard")

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
              onClick={() => go("/dashboard")}
            />
          }
        >
          <LayoutDashboard className={cn("size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110", parentActive ? "text-white" : "")} />
        </TooltipTrigger>
        <TooltipContent>Painel</TooltipContent>
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
          aria-controls="painel-sidebar-subnav"
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
          <span className="sr-only">{open ? "Recolher submenu Painel" : "Expandir submenu Painel"}</span>
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
          <LayoutDashboard className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">Painel</span>
        </button>
      </div>

      {open ? (
        <nav id="painel-sidebar-subnav" aria-label="Secções Painel" className="ml-2 border-l border-border-default pl-2">
          <ul className="flex flex-col gap-0.5">
            {PAINEL_SUBITEMS.map(({ id, label, Icon }) => {
              const href = `/dashboard?perfil=${id}`
              const active = parentActive && activePerfil === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={itemClassName(active)}
                    style={active ? { color: "#ffffff" } : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go(href)}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
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
