"use client"

import * as React from "react"
import { ChevronDownIcon, SearchIcon, CheckIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClienteOption {
  id: string
  nomeFantasia: string
}

interface Props {
  clientes: ClienteOption[]
  value: string
  onChange: (value: string) => void
  onAddCliente: () => void
}

export function ClienteCombobox({ clientes, value, onChange, onAddCliente }: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Close on outside click
  React.useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  // Focus search when opening
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch("")
    }
  }, [open])

  const filtered = clientes.filter((c) =>
    c.nomeFantasia.toLowerCase().includes(search.toLowerCase())
  )

  const displayLabel = value || "Selecionar"
  const hasValue = !!value

  function select(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-custom border px-3 py-1 text-sm outline-none transition-colors",
          "border-border-default bg-surface-input",
          open
            ? "border-brand-primary ring-2 ring-brand-primary/20"
            : "hover:border-brand-primary/50",
          hasValue ? "text-text-primary" : "text-text-secondary"
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-text-secondary transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Dropdown — absolutely positioned, always below the trigger */}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
            <SearchIcon className="size-3.5 shrink-0 text-text-secondary" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
          </div>

          {/* Scrollable options */}
          <div className="max-h-52 overflow-y-auto p-1">
            {/* None option */}
            <button
              type="button"
              onClick={() => select("")}
              className={cn(
                "flex w-full items-center gap-2 rounded-custom px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-default",
                !hasValue && "text-text-primary"
              )}
            >
              <span className="flex size-3.5 items-center justify-center">
                {!hasValue && <CheckIcon className="size-4 text-brand-primary" />}
              </span>
              Nenhum
            </button>

            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-text-secondary">Nenhum resultado.</p>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.nomeFantasia)}
                className="flex w-full items-center gap-2 rounded-custom px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-default"
              >
                <span className="flex size-3.5 items-center justify-center">
                  {value === c.nomeFantasia && <CheckIcon className="size-4 text-brand-primary" />}
                </span>
                {c.nomeFantasia}
              </button>
            ))}
          </div>

          {/* Fixed footer */}
          <div className="border-t border-border-default p-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onAddCliente() }}
              className="flex w-full items-center gap-2 rounded-custom px-3 py-1.5 text-sm font-medium text-brand-primary transition-colors hover:bg-surface-default"
            >
              <PlusIcon className="size-4" />
              Adicionar Cliente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
