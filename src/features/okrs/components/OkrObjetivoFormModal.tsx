"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  const [equipes, setEquipes] = React.useState<OkrEquipeDto[]>(initial?.equipes ?? [])
  const [errors, setErrors] = React.useState<{ descricao?: string; equipes?: string }>({})

  React.useEffect(() => {
    if (open) {
      setDescricao(initial?.descricao ?? "")
      setEquipes(initial?.equipes ?? [])
      setErrors({})
    }
  }, [open, initial?.descricao, initial?.equipes])

  function toggleEquipe(equipe: OkrEquipeDto) {
    setEquipes((prev) =>
      prev.includes(equipe) ? prev.filter((e) => e !== equipe) : [...prev, equipe],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: { descricao?: string; equipes?: string } = {}
    if (!descricao.trim()) errs.descricao = "Descrição é obrigatória."
    if (equipes.length === 0) errs.equipes = "Selecione ao menos uma equipe."
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    await onSubmit({ descricao: descricao.trim(), equipes })
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Objetivo" : "Novo Objetivo"}</DialogTitle>
        </DialogHeader>
        <form id="objetivo-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Descrição <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Ex.: Ampliar o nível de automação de testes."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              disabled={loading}
            />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Equipes responsáveis <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {OKR_EQUIPES.map((equipe) => (
                <label key={equipe} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={equipes.includes(equipe)}
                    onCheckedChange={() => toggleEquipe(equipe)}
                    disabled={loading}
                  />
                  <span className="text-sm text-text-primary">{EQUIPE_LABELS[equipe]}</span>
                </label>
              ))}
            </div>
            {errors.equipes && <p className="text-xs text-destructive">{errors.equipes}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="objetivo-form" disabled={loading}>
            {loading ? "Salvando..." : isEditing ? "Salvar" : "Criar Objetivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
