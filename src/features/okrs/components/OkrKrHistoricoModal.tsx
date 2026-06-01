"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { getOkrKrHistorico } from "@/features/okrs/actions/okrs"
import type { OkrKrHistoricoDto } from "@/features/okrs/lib/okrs-schemas"

interface OkrKrHistoricoModalProps {
  open: boolean
  onClose: () => void
  krId: string
  krDescricao: string
  unidadeLabel: string
}

function formatDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function OkrKrHistoricoModal({
  open,
  onClose,
  krId,
  krDescricao,
  unidadeLabel,
}: OkrKrHistoricoModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [historico, setHistorico] = React.useState<OkrKrHistoricoDto[]>([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || !krId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getOkrKrHistorico(krId).then((res) => {
      if (cancelled) return
      if ("error" in res) {
        setError(res.error)
        setHistorico([])
      } else {
        setHistorico(res.data)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [open, krId])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de atualizações</DialogTitle>
          <p className="mt-0.5 text-sm text-text-secondary line-clamp-2">{krDescricao}</p>
        </DialogHeader>

        <div className="min-h-[8rem]">
          {loading ? (
            <SectionSpinner minHeight="min-h-[8rem]" />
          ) : error ? (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          ) : historico.length === 0 ? (
            <EmptyState message="Nenhuma atualização registrada." />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {historico.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Valor anterior → novo */}
                    <p className="text-sm font-medium text-text-primary tabular-nums">
                      {h.valorAnterior} → {h.valorNovo}{" "}
                      <span className="font-normal text-text-secondary">{unidadeLabel}</span>
                    </p>
                    {/* Usuário */}
                    <p className="text-xs text-text-secondary">
                      {h.updatedByName ?? h.updatedByUserId}
                    </p>
                  </div>
                  {/* Data/hora */}
                  <time
                    dateTime={h.createdAt}
                    className="shrink-0 text-xs tabular-nums text-text-secondary whitespace-nowrap"
                  >
                    {formatDataHora(h.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
