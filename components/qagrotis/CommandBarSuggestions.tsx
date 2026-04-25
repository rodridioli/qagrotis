"use client"

import { ArrowRight, AlertCircle, PlusCircle, SlidersHorizontal, FileText, EyeOff, Rocket, Sparkles, Image, LayoutDashboard, Users, BookOpen, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface Suggestion {
  icon: LucideIcon
  label: string
  command: string
}

const SUGGESTIONS: Record<string, Suggestion[]> = {
  "/cenarios": [
    { icon: AlertCircle, label: "Ver cenários com erro", command: "liste cenários com mais de 3 erros" },
    { icon: PlusCircle, label: "Criar nova suite", command: "crie uma nova suite de regressão" },
    { icon: SlidersHorizontal, label: "Filtrar por módulo", command: "filtre cenários por módulo" },
    { icon: FileText, label: "Exportar para Jira", command: "exporte os cenários para o Jira" },
    { icon: EyeOff, label: "Ver cenários inativos", command: "liste cenários inativos" },
  ],
  "/suites": [
    { icon: PlusCircle, label: "Criar nova suite", command: "crie uma nova suite de regressão" },
    { icon: AlertCircle, label: "Ver suites encerradas", command: "liste suites encerradas" },
    { icon: FileText, label: "Ir para cenários", command: "ir para cenários" },
  ],
  "/gerador": [
    { icon: FileText, label: "Gerar cenário via Jira", command: "gere um cenário a partir de um issue do Jira" },
    { icon: Sparkles, label: "Gerar a partir de texto", command: "gere um cenário de teste para" },
    { icon: Image, label: "Gerar com imagem", command: "gere um cenário a partir de uma imagem de tela" },
  ],
  "/dashboard": [
    { icon: LayoutDashboard, label: "Ver meu ranking", command: "mostre meu ranking atual" },
    { icon: AlertCircle, label: "Ver atividade recente", command: "mostre minha atividade recente" },
    { icon: FileText, label: "Ir para cenários", command: "ir para cenários" },
  ],
  "/equipe": [
    { icon: PlusCircle, label: "Criar novo chapter", command: "crie um novo chapter de automação" },
    { icon: BookOpen, label: "Ver chapters recentes", command: "liste os chapters mais recentes" },
    { icon: Users, label: "Ver avaliações", command: "liste as avaliações dos chapters" },
  ],
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { icon: FileText, label: "Ir para Cenários", command: "ir para cenários" },
  { icon: Sparkles, label: "Ir para o Gerador", command: "ir para o gerador" },
  { icon: Settings, label: "Ir para Configurações", command: "ir para configurações" },
  { icon: Users, label: "Ir para Equipe", command: "ir para equipe" },
]

function getSuggestions(pathname: string): Suggestion[] {
  for (const [key, suggestions] of Object.entries(SUGGESTIONS)) {
    if (pathname.startsWith(key)) return suggestions
  }
  return DEFAULT_SUGGESTIONS
}

interface CommandBarSuggestionsProps {
  pathname: string
  onSelect: (command: string) => void
}

export function CommandBarSuggestions({ pathname, onSelect }: CommandBarSuggestionsProps) {
  const suggestions = getSuggestions(pathname)

  return (
    <div data-testid="command-bar-suggestions">
      <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
        Ações rápidas
      </p>
      <ul role="list" aria-label="Sugestões de comandos">
        {suggestions.map((s) => (
          <SuggestionItem key={s.command} suggestion={s} onSelect={onSelect} />
        ))}
      </ul>
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
          "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
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
