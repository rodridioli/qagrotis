"use client"

import * as React from "react"
import Image from "next/image"
import { Trophy } from "lucide-react"
import type { EquipeChapterRankingRow } from "@/lib/actions/equipe-chapters"
import { cn } from "@/lib/utils"

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?"
}

const ORD_LABEL: Record<EquipeChapterRankingRow["position"], string> = {
  1: "1°",
  2: "2°",
  3: "3°",
}

export interface EquipeChapterRankingProps {
  entries: EquipeChapterRankingRow[]
  className?: string
}

/**
 * Top 3 autores por pontos (participações em chapters).
 */
export function EquipeChapterRanking({ entries, className }: EquipeChapterRankingProps) {
  return (
    <aside
      className={cn(
        "flex flex-col rounded-xl border border-border-default bg-surface-card shadow-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border-default px-4 py-3">
        <Trophy className="size-5 shrink-0 text-brand-primary" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">Ranking</h2>
          <p className="text-xs text-text-secondary">1 pt por chapter em que o autor aparece</p>
        </div>
      </div>
      <div className="flex flex-col gap-0 p-2 sm:p-3">
        {entries.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-text-secondary">Nenhum ponto ainda.</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.userId}
              className="flex items-center gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-neutral-grey-50/80 dark:hover:bg-neutral-grey-900/30"
            >
              <span
                className="flex w-8 shrink-0 justify-center text-xs font-bold tabular-nums text-brand-primary"
                aria-hidden
              >
                {ORD_LABEL[e.position]}
              </span>
              {e.photoPath ? (
                <Image
                  src={e.photoPath}
                  alt={e.name}
                  width={36}
                  height={36}
                  unoptimized
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-brand-primary"
                  aria-hidden
                >
                  {getInitials(e.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary" title={e.name}>
                  {e.name}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-text-secondary">
                <span className="text-text-secondary">Pts</span>{" "}
                <span className="text-text-primary">{e.points}</span>
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
