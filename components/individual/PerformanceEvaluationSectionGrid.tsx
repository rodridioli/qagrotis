"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  columnHeaderToneClass,
  computeSectionColumnPercents,
  evaluationColumnBodyCellClass,
  evaluationColumnSelectedLabelClass,
  EVALUATION_LEVEL_LABELS,
  type PerformanceEvaluationSection,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

export interface PerformanceEvaluationSectionGridProps {
  section: PerformanceEvaluationSection
  selections: Record<string, number | undefined>
  onSelectLevel: (competencyId: string, level: number) => void
  icon: React.ReactNode
  /** Seção expansível (cabeçalho clicável), padrão execução de cenário / mockup. */
  collapsible?: boolean
  defaultOpen?: boolean
}

const competencyStickyColClass =
  "sticky left-0 z-20 min-w-[12rem] border-r border-border-default bg-neutral-grey-50 px-3 text-left sm:min-w-[14rem] sm:px-4 dark:bg-neutral-grey-900/40"

export function PerformanceEvaluationSectionGrid({
  section,
  selections,
  onSelectLevel,
  icon,
  collapsible = true,
  defaultOpen = true,
}: PerformanceEvaluationSectionGridProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const colPercents = computeSectionColumnPercents(section, selections as Record<string, number>)

  return (
    <section
      className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card"
      aria-labelledby={`sec-${section.id}`}
    >
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`sec-${section.id}-panel`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 border-b border-border-default px-4 py-3 transition-colors hover:bg-neutral-grey-50 sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              {icon}
            </span>
            <span
              id={`sec-${section.id}`}
              className="text-left text-base font-semibold text-text-primary sm:text-lg"
            >
              {section.label}
            </span>
          </span>
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-text-secondary" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-text-secondary" aria-hidden />
          )}
        </button>
      ) : (
        <div className="flex items-center gap-3 border-b border-border-default px-4 py-3 sm:px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            {icon}
          </span>
          <h2 id={`sec-${section.id}`} className="text-base font-semibold text-text-primary sm:text-lg">
            {section.label}
          </h2>
        </div>
      )}
      {open ? (
      <div id={`sec-${section.id}-panel`} className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th
                scope="col"
                className={cn(competencyStickyColClass, "py-2.5 text-xs font-semibold text-text-secondary")}
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
            {section.competencies.map((c, idx) => (
              <tr key={c.id} className="border-t border-border-default">
                <th
                  scope="row"
                  className={cn(competencyStickyColClass, "py-2.5 font-normal text-text-primary")}
                >
                  <span className="text-text-secondary tabular-nums">{idx + 1}.</span>{" "}
                  <span>{c.label}</span>
                </th>
                {EVALUATION_LEVEL_LABELS.map((_, col) => {
                  const selected = selections[c.id] === col
                  const name = `level-${section.id}-${c.id}`
                  return (
                    <td
                      key={col}
                      className={cn("p-1 text-center align-middle sm:p-1.5", evaluationColumnBodyCellClass(col))}
                    >
                      <label
                        className={cn(
                          "flex h-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-medium transition-colors sm:h-11",
                          selected
                            ? evaluationColumnSelectedLabelClass(col)
                            : "border-transparent bg-transparent text-text-secondary/80 hover:bg-neutral-grey-100/90 dark:hover:bg-neutral-grey-800/50",
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
            <tr className="border-t border-border-default">
              <th
                scope="row"
                className={cn(competencyStickyColClass, "py-2 text-xs font-medium text-text-secondary")}
              >
                Pontuação (% por coluna)
              </th>
              {colPercents.map((p, col) => (
                <td
                  key={col}
                  className={cn(
                    "px-1 py-2 text-center text-xs font-semibold tabular-nums text-text-primary sm:px-2",
                    evaluationColumnBodyCellClass(col),
                  )}
                >
                  {p.toFixed(1).replace(".", ",")}%
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      ) : null}
    </section>
  )
}
