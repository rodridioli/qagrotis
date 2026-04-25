"use client"

import { ArrowRight, PlusCircle, Sparkles, Search, CheckCircle2, RotateCcw, LayoutDashboard, Users, Settings, FileText, ClipboardCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface Suggestion {
  icon: LucideIcon
  label: string
  command: string
}

interface SuggestionGroup {
  title: string
  items: Suggestion[]
}

const SUGGESTIONS: Record<string, SuggestionGroup[]> = {
  "/cenarios": [
    {
      title: "Buscar",
      items: [
        { icon: Search, label: "Cenários com erro", command: "buscar cenários com erro" },
        { icon: Search, label: "Cenários do módulo atual", command: "buscar cenários do módulo" },
      ],
    },
    {
      title: "Ações",
      items: [
        { icon: PlusCircle, label: "Criar nova suite", command: "crie uma nova suite de regressão" },
        { icon: Sparkles, label: "Ir para o Gerador", command: "ir para o gerador" },
      ],
    },
  ],
  "/suites": [
    {
      title: "Buscar",
      items: [
        { icon: Search, label: "Suites ativas", command: "buscar suites ativas" },
        { icon: Search, label: "Suites encerradas", command: "buscar suites encerradas" },
      ],
    },
    {
      title: "Ações",
      items: [
        { icon: PlusCircle, label: "Criar nova suite", command: "crie uma nova suite de regressão" },
        { icon: CheckCircle2, label: "Encerrar uma suite", command: "encerrar suite" },
        { icon: RotateCcw, label: "Reabrir uma suite", command: "reabrir suite" },
      ],
    },
  ],
  "/gerador": [
    {
      title: "Navegar",
      items: [
        { icon: FileText, label: "Ir para cenários", command: "ir para cenários" },
        { icon: ArrowRight, label: "Ir para suites", command: "ir para suites" },
      ],
    },
  ],
  "/dashboard": [
    {
      title: "Buscar",
      items: [
        { icon: Search, label: "Suites ativas", command: "buscar suites ativas" },
        { icon: Search, label: "Cenários com erro", command: "buscar cenários com erro" },
      ],
    },
    {
      title: "Ações",
      items: [
        { icon: PlusCircle, label: "Criar nova suite", command: "crie uma nova suite de regressão" },
        { icon: FileText, label: "Ir para cenários", command: "ir para cenários" },
      ],
    },
  ],
  "/equipe": [
    {
      title: "Navegar",
      items: [
        { icon: LayoutDashboard, label: "Ir para o painel", command: "ir para o painel" },
        { icon: FileText, label: "Ir para cenários", command: "ir para cenários" },
      ],
    },
  ],
}

const DEFAULT_SUGGESTIONS: SuggestionGroup[] = [
  {
    title: "Buscar",
    items: [
      { icon: Search, label: "Cenários com erro", command: "buscar cenários com erro" },
      { icon: Search, label: "Suites ativas", command: "buscar suites ativas" },
    ],
  },
  {
    title: "Navegar",
    items: [
      { icon: FileText, label: "Cenários", command: "ir para cenários" },
      { icon: Sparkles, label: "Gerador de cenários", command: "ir para o gerador" },
      { icon: Settings, label: "Configurações", command: "ir para configurações" },
      { icon: Users, label: "Equipe", command: "ir para equipe" },
    ],
  },
]

function getSuggestionGroups(pathname: string): SuggestionGroup[] {
  for (const [key, groups] of Object.entries(SUGGESTIONS)) {
    if (pathname.startsWith(key)) return groups
  }
  return DEFAULT_SUGGESTIONS
}

interface CommandBarSuggestionsProps {
  pathname: string
  onSelect: (command: string) => void
}

export function CommandBarSuggestions({ pathname, onSelect }: CommandBarSuggestionsProps) {
  const groups = getSuggestionGroups(pathname)

  return (
    <div data-testid="command-bar-suggestions">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
            {group.title}
          </p>
          <ul role="list" aria-label={group.title}>
            {group.items.map((s) => (
              <SuggestionItem key={s.command} suggestion={s} onSelect={onSelect} />
            ))}
          </ul>
        </div>
      ))}
      <div className="pb-1" />
    </div>
  )
}

function SuggestionItem({ suggestion, onSelect }: { suggestion: Suggestion; onSelect: (cmd: string) => void }) {
  const Icon = suggestion.icon

  return (
    <li role="listitem">
      <button
        type="button"
        onClick={() => onSelect(suggestion.command)}
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
          "hover:bg-surface-default focus-visible:bg-surface-default focus-visible:outline-none"
        )}
        data-testid="command-bar-suggestion-item"
      >
        <Icon className="size-3.5 shrink-0 text-text-secondary group-hover:text-brand-primary" aria-hidden="true" />
        <span className="flex-1 text-sm text-text-primary">{suggestion.label}</span>
        <ArrowRight className="size-3.5 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </button>
    </li>
  )
}
