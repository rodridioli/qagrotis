"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select"
import { OKR_EQUIPES, EQUIPE_LABELS, type OkrEquipeDto, type OkrObjetivoDto } from "@/features/okrs/lib/okrs-schemas"

interface OkrObjetivoFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { descricao: string; equipes: OkrEquipeDto[] }) => Promise<void>
  loading?: boolean
  initial?: Pick<OkrObjetivoDto, "descricao" | "equipes">
}

export function OkrObjetivoFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  initial,
}: OkrObjetivoFormModalProps) {
  const [descricao, setDescricao] = React.useState(initial?.descricao ?? "")
  const [equipe, setEquipe] = React.useState<OkrEquipeDto | "">(initial?.equipes?.[0] ?? "")
  const [errors, setErrors] = React.useState<{ descricao?: string; equipe?: string }>({})

  React.useEffect(() => {
    if (open) {
      setDescricao(initial?.descricao ?? "")
      setEquipe(initial?.equipes?.[0] ?? "")
      setErrors({})
    }
  }, [open, initial?.descricao, initial?.equipes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: { descricao?: string; equipe?: string } = {}
    if (!descricao.trim()) errs.descricao = "Objetivo é obrigatório."
    if (!equipe) errs.equipe = "Selecione uma equipe."
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    await onSubmit({ descricao: descricao.trim(), equipes: [equipe as OkrEquipeDto] })
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Objetivo" : "Novo Objetivo"}</DialogTitle>
        </DialogHeader>
        <form id="objetivo-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Objetivo <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Ex.: Ampliar o nível de automação de testes."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={loading}
            />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Equipe responsável <span className="text-destructive">*</span>
            </label>
            <Select
              value={equipe}
              onValueChange={(v) => setEquipe(v as OkrEquipeDto)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectPopup>
                {OKR_EQUIPES.map((eq) => (
                  <SelectItem key={eq} value={eq}>
                    {EQUIPE_LABELS[eq]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            {errors.equipe && <p className="text-xs text-destructive">{errors.equipe}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="gap-1.5">
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button type="submit" form="objetivo-form" disabled={loading} className="gap-1.5">
            {loading ? (
              <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
            ) : isEditing ? (
              <><Check className="size-4 shrink-0" aria-hidden />Salvar</>
            ) : (
              <><Check className="size-4 shrink-0" aria-hidden />Criar Objetivo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
