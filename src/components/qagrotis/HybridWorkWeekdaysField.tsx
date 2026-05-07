"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { HIBRIDO_DIA_IDS, HIBRIDO_DIA_LABELS, type DiaSemanaHibridoId } from "@/lib/usuario-trabalho"
import { cn } from "@/lib/utils"

export interface HybridWorkWeekdaysFieldProps {
  /** Ids selecionados: dias **fora** do escritório (`seg`…`dom`). */
  value: readonly string[]
  onChange: (next: DiaSemanaHibridoId[]) => void
  disabled?: boolean
  /** Prefixo para ids estáveis (ex.: `novo`, `edit-U-02`). */
  idPrefix: string
  className?: string
}

/**
 * Dias da semana em que a pessoa **não** está presencial (fora do escritório) no modelo Híbrido.
 * Mobile-first: 2 colunas estreitas, 4 a partir de `sm`, 7 em `lg`.
 */
export function HybridWorkWeekdaysField({
  value,
  onChange,
  disabled,
  idPrefix,
  className,
}: HybridWorkWeekdaysFieldProps) {
  const set = React.useMemo(() => new Set(value), [value])

  function toggle(id: DiaSemanaHibridoId) {
    if (disabled) return
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(HIBRIDO_DIA_IDS.filter((d) => next.has(d)))
  }

  const legendId = `${idPrefix}-hibrido-dias-legend`
  const hintId = `${idPrefix}-hibrido-dias-hint`

  return (
    <fieldset
      className={cn(
        "rounded-lg border border-border-default bg-surface-input/40 p-3 sm:p-4",
        className,
      )}
    >
      <legend id={legendId} className="px-1 text-sm font-medium text-text-primary">
        Dias fora do escritório (híbrido)
      </legend>
      <p id={hintId} className="mb-3 text-xs text-text-secondary">
        Marque os dias em que a pessoa trabalha em formato híbrido fora do escritório (não presencial).
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-describedby={hintId}>
        {HIBRIDO_DIA_IDS.map((id) => {
          const cid = `${idPrefix}-dia-${id}`
          return (
            <div
              key={id}
              className="flex min-h-11 items-center rounded-md border border-transparent px-0.5 py-1 sm:min-h-0 sm:flex-col sm:items-stretch sm:py-2"
            >
              <Checkbox
                id={cid}
                checked={set.has(id)}
                onChange={() => toggle(id)}
                disabled={disabled}
                label={HIBRIDO_DIA_LABELS[id]}
              />
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
