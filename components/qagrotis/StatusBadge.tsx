import * as React from "react"
import { cn } from "@/lib/utils"

type CenarioTipo = "Automatizado" | "Manual" | "Man./Auto."
type SuiteTipo = "Sprint" | "Kanban" | "Outro"

function CenarioTipoBadge({ tipo }: { tipo: CenarioTipo }) {
  if (tipo === "Automatizado") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
        {tipo}
      </span>
    )
  }
  if (tipo === "Manual") {
    return (
      <span className="inline-flex items-center rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-medium text-secondary-600">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
      {tipo}
    </span>
  )
}

function SuiteTipoBadge({ tipo }: { tipo: SuiteTipo }) {
  if (tipo === "Sprint") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
        {tipo}
      </span>
    )
  }
  if (tipo === "Kanban") {
    return (
      <span className="inline-flex items-center rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-medium text-secondary-600">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
      {tipo}
    </span>
  )
}

function AutomacaoBadge({ pct }: { pct: number }) {
  if (pct === 100) {
    return (
      <span className="inline-flex items-center rounded-full border border-green-600/30 bg-green-600/10 px-3 py-1 text-xs font-medium text-green-700">
        {pct}%
      </span>
    )
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">
        {pct}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border-default bg-neutral-grey-50 px-3 py-1 text-xs font-medium text-text-secondary">
      {pct}%
    </span>
  )
}

function UserTipoBadge({ tipo }: { tipo: string }) {
  if (tipo === "Administrador") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-medium text-secondary-600">
      {tipo}
    </span>
  )
}

function StatusBadge({
  label,
  colorClass,
}: {
  label: string
  colorClass: string
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", colorClass)}>
      {label}
    </span>
  )
}

type ChangelogTag =
  | "Lançamento"
  | "Segurança"
  | "Segurança e Performance"
  | "Design System"
  | "Produto"
  | "Melhorias"

function ChangelogTagBadge({ tag }: { tag: string }) {
  const styles: Record<string, string> = {
    "Lançamento":              "border-brand-primary/30 bg-brand-primary/10 text-brand-primary",
    "Segurança":               "border-red-500/30 bg-red-500/10 text-red-600",
    "Segurança e Performance": "border-red-500/30 bg-red-500/10 text-red-600",
    "Design System":           "border-purple-500/30 bg-purple-500/10 text-purple-600",
    "Produto":                 "border-secondary-500/30 bg-secondary-500/10 text-secondary-600",
    "Melhorias":               "border-green-600/30 bg-green-600/10 text-green-700",
  }
  const cls = styles[tag] ?? "border-border-default bg-neutral-grey-50 text-text-secondary"
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {tag}
    </span>
  )
}

export { StatusBadge, CenarioTipoBadge, SuiteTipoBadge, AutomacaoBadge, UserTipoBadge, ChangelogTagBadge }
export type { CenarioTipo, SuiteTipo, ChangelogTag }
