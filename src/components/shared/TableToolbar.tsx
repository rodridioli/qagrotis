"use client"

import React from "react"
import { Search, SlidersHorizontal } from "lucide-react"

type TableToolbarBaseProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  activeFilterCount?: number
  onFilterOpen?: () => void
  /** Total records before any user-applied search/filter. When 0, hides search and filter controls. */
  baseCount: number
  extra?: React.ReactNode
}

export type TableToolbarProps =
  | (TableToolbarBaseProps & { leadingSummary: React.ReactNode })
  | (TableToolbarBaseProps & { totalLabel: string; totalCount: number })

export function TableToolbar(props: TableToolbarProps) {
  const {
    search,
    onSearchChange,
    searchPlaceholder = "Buscar...",
    activeFilterCount,
    onFilterOpen,
    baseCount,
    extra,
  } = props
  const showControls = baseCount > 0

  const left =
    "leadingSummary" in props ? (
      props.leadingSummary
    ) : (
      <span className="text-sm font-medium text-text-primary">
        {props.totalLabel}:{" "}
        <span className="font-bold">{props.totalCount.toLocaleString("pt-BR")}</span>
      </span>
    )

  return (
    <div className="flex h-16 items-center justify-between gap-3 border-b border-border-default px-5">
      <div className="min-w-0 shrink">{left}</div>
      <div className="flex items-center gap-2">
        {showControls && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-9 w-48 rounded-custom border border-border-default bg-surface-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 lg:w-64"
              />
            </div>
            {onFilterOpen && (
              <button
                type="button"
                onClick={onFilterOpen}
                className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
              >
                <SlidersHorizontal className="size-4" />
                {(activeFilterCount ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-primary text-primary-foreground text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
            {extra}
          </>
        )}
      </div>
    </div>
  )
}
