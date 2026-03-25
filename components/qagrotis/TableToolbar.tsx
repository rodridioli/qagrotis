"use client"

import React from "react"
import { Search, SlidersHorizontal } from "lucide-react"

interface TableToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  activeFilterCount: number
  onFilterOpen: () => void
  totalLabel: string
  totalCount: number
  extra?: React.ReactNode
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  activeFilterCount,
  onFilterOpen,
  totalLabel,
  totalCount,
  extra,
}: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <span className="text-sm font-medium text-text-primary">
        {totalLabel}:{" "}
        <span className="font-bold">{totalCount.toLocaleString("pt-BR")}</span>
      </span>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 w-full rounded-custom border border-border-default bg-surface-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:w-56 lg:w-64"
          />
        </div>
        <button
          type="button"
          onClick={onFilterOpen}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <SlidersHorizontal className="size-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand-primary text-xs" style={{ color: "#ffffff" }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        {extra}
      </div>
    </div>
  )
}
