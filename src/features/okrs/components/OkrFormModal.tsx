"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { OKR_PERIODOS, PERIODO_LABELS, type OkrPeriodoDto } from "@/features/okrs/lib/okrs-schemas"

interface OkrFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { ano: number; periodo: OkrPeriodoDto }) => Promise<void>
  loading?: boolean
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export function OkrFormModal({ open, onClose, onSubmit, loading }: OkrFormModalProps) {
  const [ano, setAno] = React.useState(String(CURRENT_YEAR))
  const [periodo, setPeriodo] = React.useState<OkrPeriodoDto>("Q2")
  const [errors, setErrors] = React.useState<{ ano?: string; periodo?: string }>({})

  React.useEffect(() => {
    if (!open) {
      setAno(String(CURRENT_YEAR))
      setPeriodo("Q2")
      setErrors({})
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const anoNum = parseInt(ano, 10)
    const errs: { ano?: string } = {}
    if (!ano || Number.isNaN(anoNum) || anoNum < 2020 || anoNum > 2100) {
      errs.ano = "Ano inválido."
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    await onSubmit({ ano: anoNum, periodo })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo OKR</DialogTitle>
        </DialogHeader>
        <form id="okr-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Ano <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              disabled={loading}
            />
            {errors.ano && <p className="text-xs text-destructive">{errors.ano}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Período <span className="text-destructive">*</span>
            </label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as OkrPeriodoDto)}>
              <SelectTrigger disabled={loading}>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectPopup>
                {OKR_PERIODOS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PERIODO_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="okr-form" disabled={loading}>
            {loading ? "Criando..." : "Criar OKR"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
