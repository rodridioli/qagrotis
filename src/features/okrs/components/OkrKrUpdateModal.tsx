"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { UNIDADE_LABELS, type OkrKeyResultDto } from "@/features/okrs/lib/okrs-schemas"
import { OkrProgressBar } from "@/features/okrs/components/OkrProgressBar"

interface OkrKrUpdateModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (valorAtual: number) => Promise<void>
  kr: Pick<OkrKeyResultDto, "descricao" | "valorAtual" | "meta" | "unidade" | "unidadePersonalizada">
  loading?: boolean
}

export function OkrKrUpdateModal({ open, onClose, onSubmit, kr, loading }: OkrKrUpdateModalProps) {
  const [valor, setValor] = React.useState(String(kr.valorAtual))
  const [error, setError] = React.useState("")

  const unidadeLabel =
    kr.unidade === "PERSONALIZADA"
      ? (kr.unidadePersonalizada ?? "")
      : UNIDADE_LABELS[kr.unidade]

  React.useEffect(() => {
    if (open) {
      setValor(String(kr.valorAtual))
      setError("")
    }
  }, [open, kr.valorAtual])

  const valorNum = parseFloat(valor)
  const previewPct = kr.meta > 0 && !Number.isNaN(valorNum) ? Math.min((valorNum / kr.meta) * 100, 100) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (Number.isNaN(valorNum) || valorNum < 0) {
      setError("Valor inválido.")
      return
    }
    setError("")
    await onSubmit(valorNum)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atualizar valor atual</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary line-clamp-2">{kr.descricao}</p>
        <form id="kr-update-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Valor atual ({unidadeLabel}) <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={loading}
                className="flex-1"
              />
              <span className="text-sm text-text-secondary whitespace-nowrap">
                / {kr.meta} {unidadeLabel}
              </span>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Progresso</span>
              <span className="tabular-nums font-medium">{previewPct.toFixed(0)}%</span>
            </div>
            <OkrProgressBar value={previewPct} max={100} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="gap-1.5">
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button type="submit" form="kr-update-form" disabled={loading} className="gap-1.5">
            {loading ? (
              <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
            ) : (
              <><Check className="size-4 shrink-0" aria-hidden />Salvar</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
