"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { EquipeChapterAuthorOption } from "@/lib/actions/equipe-chapters"

export interface ChapterAuthorsPicklistProps {
  options: EquipeChapterAuthorOption[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  idPrefix: string
  className?: string
}

/**
 * Multi-seleção de autores ativos com busca (mobile-first).
 */
export function ChapterAuthorsPicklist({
  options,
  value,
  onChange,
  disabled,
  idPrefix,
  className,
}: ChapterAuthorsPicklistProps) {
  const [q, setQ] = React.useState("")
  const set = React.useMemo(() => new Set(value), [value])

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return options
    return options.filter((o) => o.name.toLowerCase().includes(t) || o.id.toLowerCase().includes(t))
  }, [options, q])

  function toggle(id: string) {
    if (disabled) return
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-text-primary" htmlFor={`${idPrefix}-author-search`}>
        Autor(res) <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
        <Input
          id={`${idPrefix}-author-search`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome…"
          disabled={disabled}
          className="pl-9"
          autoComplete="off"
        />
      </div>
      <div
        className="max-h-52 overflow-y-auto rounded-lg border border-border-default bg-surface-input/40 p-2 sm:max-h-60"
        role="group"
        aria-label="Lista de autores"
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-text-secondary">Nenhum autor encontrado.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((o) => (
              <li key={o.id}>
                <Checkbox
                  id={`${idPrefix}-author-${o.id}`}
                  checked={set.has(o.id)}
                  onChange={() => toggle(o.id)}
                  disabled={disabled}
                  label={o.name}
                  className="w-full rounded-md px-2 py-2 hover:bg-surface-card/80"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
