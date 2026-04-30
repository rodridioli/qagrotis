"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BookOpen, HeartHandshake, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { updateIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"
import type { IndividualPerformanceEvaluationDetail } from "@/lib/actions/individual-performance-evaluations"
import {
  columnHeaderToneClass,
  computeSectionColumnPercents,
  EVALUATION_LEVEL_LABELS,
  PERFORMANCE_EVALUATION_SECTIONS,
  type PerformanceEvaluationSectionId,
} from "@/lib/individual-performance-evaluation"
import { cn } from "@/lib/utils"

const SECTION_ICONS: Record<PerformanceEvaluationSectionId, React.ElementType> = {
  conhecimentos: BookOpen,
  habilidades: Sparkles,
  atitudes: HeartHandshake,
}

export interface IndividualPerformanceEvaluationFormProps {
  detail: IndividualPerformanceEvaluationDetail
  queryUserId: string
}

export function IndividualPerformanceEvaluationForm({
  detail,
  queryUserId,
}: IndividualPerformanceEvaluationFormProps) {
  const router = useRouter()
  const [selections, setSelections] = React.useState<Record<string, number | undefined>>(() => {
    const m: Record<string, number | undefined> = {}
    for (const [k, v] of Object.entries(detail.selections)) {
      m[k] = v
    }
    return m
  })
  const [busy, setBusy] = React.useState<"save" | "complete" | null>(null)

  const backHref = `/individual/avaliacoes?userId=${encodeURIComponent(queryUserId)}`

  function setLevel(competencyId: string, level: number) {
    setSelections((prev) => ({ ...prev, [competencyId]: level }))
  }

  async function submit(mode: "save" | "complete") {
    const payload: Record<string, number> = {}
    for (const [k, v] of Object.entries(selections)) {
      if (v !== undefined && v >= 0 && v <= 4) payload[k] = v
    }
    setBusy(mode)
    try {
      const res = await updateIndividualPerformanceEvaluation({
        id: detail.id,
        selections: payload,
        mode,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(mode === "complete" ? "Avaliação concluída." : "Rascunho salvo.")
      router.push(backHref)
      router.refresh()
    } catch (e) {
      console.error(e)
      toast.error("Não foi possível salvar.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "inline-flex w-fit gap-2 text-text-secondary",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar às avaliações
        </Link>
        <p className="text-xs text-muted-foreground">
          Código <span className="font-mono font-semibold text-text-primary">{detail.codigo}</span>
          {detail.status === "CONCLUIDA" ? (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-primary">Concluída</span>
          ) : (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Rascunho</span>
          )}
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-card p-4 shadow-card sm:p-6">
        <h1 className="text-lg font-semibold text-text-primary sm:text-xl">Avaliação de desempenho</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Marque um nível por competência. Use <strong>Salvar</strong> para rascunho ou <strong>Concluir</strong> quando
          todas estiverem preenchidas.
        </p>
      </div>

      {PERFORMANCE_EVALUATION_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id]
        const colPercents = computeSectionColumnPercents(section, selections as Record<string, number>)
        return (
          <section
            key={section.id}
            className="rounded-xl border border-border-default bg-surface-card shadow-card"
            aria-labelledby={`sec-${section.id}`}
          >
            <div className="flex items-center gap-3 border-b border-border-default px-4 py-3 sm:px-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-primary">
                <Icon className="size-5" aria-hidden />
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
                        const name = `level-${c.id}`
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
                                onChange={() => setLevel(c.id, col)}
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
      })}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border-default bg-surface-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-surface-card/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              busy != null && "pointer-events-none opacity-50",
            )}
            aria-disabled={busy != null}
          >
            Cancelar
          </Link>
          <Button
            type="button"
            variant="secondary"
            disabled={busy != null}
            onClick={() => void submit("save")}
          >
            {busy === "save" ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            type="button"
            disabled={busy != null}
            onClick={() => void submit("complete")}
          >
            {busy === "complete" ? "Concluindo…" : "Concluir"}
          </Button>
        </div>
      </div>
    </div>
  )
}
