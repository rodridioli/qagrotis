"use client"

import * as React from "react"
import { ChevronDownIcon, SearchIcon, CheckIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface CredencialOption {
  id: string
  nome: string
  urlAmbiente?: string | null
  usuario: string
}

interface Props {
  credenciais: CredencialOption[]
  value: string
  onChange: (value: string) => void
  onAddCredencial: () => void
  disabled?: boolean
}

export function CredencialCombobox({ credenciais, value, onChange, onAddCredencial, disabled = false }: Props) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

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
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch("")
    }
  }, [open])

  const filtered = credenciais.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  )

  const selected = credenciais.find((c) => c.id === value)
  const displayLabel = selected ? selected.nome : "Selecionar"
  const hasValue = !!value

  function select(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-custom border px-3 py-1 text-sm outline-none transition-colors",
          "border-border-default bg-surface-input",
          disabled
            ? "cursor-not-allowed opacity-60"
            : open
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

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-500 overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          <div className="flex items-center gap-2 border-b border-border-default px-3 py-2">
            <SearchIcon className="size-3.5 shrink-0 text-text-secondary" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar credencial..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-text-secondary">Nenhum resultado.</p>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className="flex w-full items-center gap-2 rounded-custom px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-default"
              >
                <span className="flex size-3.5 items-center justify-center">
                  {value === c.id && <CheckIcon className="size-4 text-brand-primary" />}
                </span>
                <span className="flex-1 text-left">
                  <span className="block truncate">{c.nome}</span>
                  {c.urlAmbiente && (
                    <span className="block truncate text-xs text-text-secondary">{c.urlAmbiente}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-border-default p-1">
            <button
              type="button"
              onClick={() => { setOpen(false); onAddCredencial() }}
              className="flex w-full items-center gap-2 rounded-custom px-3 py-1.5 text-sm font-medium text-brand-primary transition-colors hover:bg-surface-default"
            >
              <PlusIcon className="size-4" />
              Adicionar Credencial
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
