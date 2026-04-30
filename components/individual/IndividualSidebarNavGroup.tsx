"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronRight, User } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { INDIVIDUAL_NAV_ENTRIES } from "@/components/individual/individualNavEntries"

function querySuffixFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): string {
  const userId = searchParams.get("userId")
  if (!userId) return ""
  return `?userId=${encodeURIComponent(userId)}`
}

export interface IndividualSidebarNavGroupProps {
  collapsed: boolean
  onNavigate?: (href: string) => void
}

export function IndividualSidebarNavGroup({ collapsed, onNavigate }: IndividualSidebarNavGroupProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const suffix = querySuffixFromSearchParams(searchParams)

  const [open, setOpen] = React.useState(false)
  const prevPath = React.useRef("")

  React.useEffect(() => {
    const now = pathname.startsWith("/individual")
    const was = prevPath.current.startsWith("/individual")
    prevPath.current = pathname
    if (now && !was) setOpen(true)
    if (!now && was) setOpen(false)
  }, [pathname])

  const parentActive = pathname.startsWith("/individual")
  const showLabel = !collapsed

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
    const href = `/individual/ficha${suffix}`
    const itemChildren = (
      <>
        <User className={cn("size-4.5 shrink-0 transition-transform duration-150 group-hover:scale-110", parentActive ? "text-white" : "")} />
        {showLabel && <span className="truncate">Individual</span>}
      </>
    )
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              style={itemStyle}
              className={cn(itemClassName, "w-full cursor-pointer")}
              onClick={() => go(href)}
            />
          }
        >
          {itemChildren}
        </TooltipTrigger>
        <TooltipContent>Individual</TooltipContent>
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
          aria-controls="individual-sidebar-subnav"
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
          <span className="sr-only">{open ? "Recolher submenu Individual" : "Expandir submenu Individual"}</span>
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
          <User className="size-4.5 shrink-0" aria-hidden />
          <span className="truncate">Individual</span>
        </button>
      </div>

      {open ? (
        <nav id="individual-sidebar-subnav" aria-label="Secções Individual" className="ml-2 border-l border-border-default pl-2">
          <ul className="flex flex-col gap-0.5">
          {INDIVIDUAL_NAV_ENTRIES.map(({ slug, label, icon: Icon }) => {
            const href = `/individual/${slug}${suffix}`
            const active =
              pathname === `/individual/${slug}` ||
              (slug === "avaliacoes" && pathname.startsWith("/individual/avaliacoes/"))
            return (
              <li key={slug}>
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
