"use client"

import * as React from "react"
import {
  columnHeaderToneClass,
  computeSectionColumnPercents,
  EVALUATION_LEVEL_LABELS,
  type PerformanceEvaluationSection,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

export interface PerformanceEvaluationSectionGridProps {
  section: PerformanceEvaluationSection
  selections: Record<string, number | undefined>
  onSelectLevel: (competencyId: string, level: number) => void
  icon: React.ReactNode
}

export function PerformanceEvaluationSectionGrid({
  section,
  selections,
  onSelectLevel,
  icon,
}: PerformanceEvaluationSectionGridProps) {
  const colPercents = computeSectionColumnPercents(section, selections as Record<string, number>)

  return (
    <section
      className="rounded-xl border border-border-default bg-surface-card shadow-card"
      aria-labelledby={`sec-${section.id}`}
    >
      <div className="flex items-center gap-3 border-b border-border-default px-4 py-3 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-primary">
          {icon}
        </span>
        <h2 id={`sec-${section.id}`} className="text-base font-semibold text-text-primary sm:text-lg">
          {section.label}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[12rem] bg-surface-card px-3 py-2 text-left text-xs font-medium text-text-secondary sm:min-w-[14rem] sm:px-4"
              >
                Competência
              </th>
              {EVALUATION_LEVEL_LABELS.map((label, col) => (
                <th
                  key={label}
                  scope="col"
                  className={cn(
                    "min-w-[5.5rem] px-1 py-2 text-center text-xs font-semibold sm:min-w-24 sm:px-2",
                    columnHeaderToneClass(col),
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.competencies.map((c) => (
              <tr key={c.id} className="border-t border-border-default">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-card px-3 py-2.5 text-left font-normal text-text-primary sm:px-4"
                >
                  {c.label}
                </th>
                {EVALUATION_LEVEL_LABELS.map((_, col) => {
                  const selected = selections[c.id] === col
                  const name = `level-${section.id}-${c.id}`
                  return (
                    <td key={col} className="p-1 text-center align-middle sm:p-1.5">
                      <label
                        className={cn(
                          "flex h-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-medium transition-colors sm:h-11",
                          selected
                            ? "border-brand-primary bg-primary/15 text-brand-primary ring-2 ring-brand-primary/30"
                            : "border-transparent bg-muted/40 text-muted-foreground hover:border-border-default hover:bg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name={name}
                          value={col}
                          checked={selected}
                          className="sr-only"
                          onChange={() => onSelectLevel(c.id, col)}
                        />
                        <span aria-hidden className="text-base font-bold">
                          {selected ? "✓" : ""}
                        </span>
                        <span className="sr-only">{EVALUATION_LEVEL_LABELS[col]}</span>
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t border-border-default bg-muted/30">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-text-secondary sm:px-4"
              >
                Pontuação (% por coluna)
              </th>
              {colPercents.map((p, col) => (
                <td
                  key={col}
                  className={cn(
                    "px-1 py-2 text-center text-xs font-medium tabular-nums sm:px-2",
                    columnHeaderToneClass(col),
                  )}
                >
                  {p.toFixed(1).replace(".", ",")}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
