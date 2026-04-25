"use client"

import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface CommandBarItem {
  id: string
  name: string
  module: string
  meta?: string
}

interface CommandBarResultProps {
  title: string
  items: CommandBarItem[]
  viewAllPath: string
  onViewAll: () => void
  onClose: () => void
}

export function CommandBarResult({ title, items, onViewAll, onClose }: CommandBarResultProps) {
  return (
    <div className="p-3" data-testid="command-bar-result">
      <p className="mb-2 text-sm font-semibold text-text-primary">{title}</p>

      <ul className="space-y-1" aria-label="Resultados">
        {items.slice(0, 5).map((item) => (
          <ResultItem key={item.id} item={item} />
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onViewAll}
          data-testid="command-bar-view-all"
        >
          Ver todos
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  )
}

function ResultItem({ item }: { item: CommandBarItem }) {
  return (
    <li className={cn(
      "flex items-center gap-2 rounded px-2 py-1.5",
      "bg-surface-default"
    )}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-primary">{item.name}</p>
        <p className="text-[10px] text-text-secondary">{item.module}</p>
      </div>
      {item.meta && (
        <span className="shrink-0 rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          {item.meta}
        </span>
      )}
    </li>
  )
}
