"use client"

import * as React from "react"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EquipeChapterAuthorOption } from "@/lib/actions/equipe-chapters"

export interface ChapterAuthorsMultiComboboxProps {
  options: EquipeChapterAuthorOption[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  idPrefix: string
  className?: string
}

function summaryLabel(options: EquipeChapterAuthorOption[], ids: string[]): string {
  if (ids.length === 0) return "Selecionar autor(es)…"
  const names = ids
    .map((id) => options.find((o) => o.id === id)?.name ?? id)
    .filter(Boolean)
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  return `${names[0]} +${names.length - 1}`
}

/**
 * Select multi com busca: gatilho estilo campo fechado; ao abrir, lista com checkbox por usuário ativo.
 */
export function ChapterAuthorsMultiCombobox({
  options,
  value,
  onChange,
  disabled,
  idPrefix,
  className,
}: ChapterAuthorsMultiComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const selectedIds = React.useMemo(() => new Set(value), [value])

  React.useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0)
    else setQ("")
  }, [open])

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return options
    return options.filter((o) => o.name.toLowerCase().includes(t) || o.id.toLowerCase().includes(t))
  }, [options, q])

  function toggle(id: string) {
    if (disabled) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  const label = summaryLabel(options, value)

  return (
    <div ref={containerRef} className={cn("relative space-y-2", className)}>
      <span className="text-sm font-medium text-text-primary" id={`${idPrefix}-authors-label`}>
        Autor(res) <span className="text-destructive">*</span>
      </span>
      <button
        type="button"
        id={`${idPrefix}-authors-trigger`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${idPrefix}-authors-label ${idPrefix}-authors-trigger`}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-custom border px-3 py-1 text-left text-sm outline-none transition-colors",
          "border-border-default bg-surface-input",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer",
          !disabled &&
            (open
              ? "border-brand-primary ring-2 ring-brand-primary/20"
              : "hover:border-brand-primary/50"),
          value.length ? "text-text-primary" : "text-text-secondary",
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-text-secondary transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-[500] mt-1 max-h-[min(22rem,calc(100vh-12rem))] overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card"
          role="listbox"
          aria-multiselectable
          aria-label="Autores"
        >
          <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
            <Search className="size-3.5 shrink-0 text-text-secondary" />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome…"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-2 sm:max-h-60">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-text-secondary">Nenhum autor encontrado.</p>
            ) : (
              <ul className="min-w-0 space-y-1">
                {filtered.map((o) => {
                  const cid = `${idPrefix}-author-${o.id}`
                  return (
                    <li key={o.id} className="min-w-0">
                      <label
                        htmlFor={cid}
                        className={cn(
                          "flex min-w-0 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-input/80",
                          disabled && "pointer-events-none cursor-not-allowed opacity-50",
                        )}
                      >
                        <input
                          id={cid}
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          disabled={disabled}
                          onChange={() => toggle(o.id)}
                          className="size-4 shrink-0 rounded border border-border-default bg-surface-input accent-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed"
                        />
                        <span
                          className="min-w-0 flex-1 truncate text-sm text-text-primary select-none"
                          title={o.name}
                        >
                          {o.name}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
