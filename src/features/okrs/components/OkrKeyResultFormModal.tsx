"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  OKR_UNIDADES,
  UNIDADE_LABELS,
  type OkrUnidadeDto,
  type OkrKeyResultDto,
  type OkrEquipeDto,
} from "@/features/okrs/lib/okrs-schemas"
import type { OkrEquipeMembro } from "@/features/okrs/actions/okrs"

interface OkrKeyResultFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    descricao: string
    unidade: OkrUnidadeDto
    unidadePersonalizada?: string
    valorInicial: number
    meta: number
    responsaveis: string[]
  }) => Promise<void>
  loading?: boolean
  membros: OkrEquipeMembro[]
  initial?: Pick<OkrKeyResultDto, "descricao" | "unidade" | "unidadePersonalizada" | "valorInicial" | "meta" | "responsaveis">
}

export function OkrKeyResultFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  membros,
  initial,
}: OkrKeyResultFormModalProps) {
  const [descricao, setDescricao] = React.useState(initial?.descricao ?? "")
  const [unidade, setUnidade] = React.useState<OkrUnidadeDto>(initial?.unidade ?? "PERCENTUAL")
  const [unidadePersonalizada, setUnidadePersonalizada] = React.useState(initial?.unidadePersonalizada ?? "")
  const [valorInicial, setValorInicial] = React.useState(String(initial?.valorInicial ?? "0"))
  const [meta, setMeta] = React.useState(String(initial?.meta ?? "100"))
  const [responsaveis, setResponsaveis] = React.useState<string[]>(
    initial?.responsaveis?.map((r) => r.userId) ?? [],
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setDescricao(initial?.descricao ?? "")
      setUnidade(initial?.unidade ?? "PERCENTUAL")
      setUnidadePersonalizada(initial?.unidadePersonalizada ?? "")
      setValorInicial(String(initial?.valorInicial ?? "0"))
      setMeta(String(initial?.meta ?? "100"))
      setResponsaveis(initial?.responsaveis?.map((r) => r.userId) ?? [])
      setErrors({})
    }
  }, [open])

  function toggleResponsavel(userId: string) {
    setResponsaveis((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!descricao.trim()) errs.descricao = "Descrição é obrigatória."
    const viNum = parseFloat(valorInicial)
    const metaNum = parseFloat(meta)
    if (Number.isNaN(viNum) || viNum < 0) errs.valorInicial = "Valor inicial inválido."
    if (Number.isNaN(metaNum) || metaNum < 0) errs.meta = "Meta inválida."
    if (unidade === "PERSONALIZADA" && !unidadePersonalizada.trim()) {
      errs.unidadePersonalizada = "Informe a unidade personalizada."
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    await onSubmit({
      descricao: descricao.trim(),
      unidade,
      unidadePersonalizada: unidade === "PERSONALIZADA" ? unidadePersonalizada.trim() : undefined,
      valorInicial: viNum,
      meta: metaNum,
      responsaveis,
    })
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Key Result" : "Novo Key Result"}</DialogTitle>
        </DialogHeader>
        <form id="kr-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Descrição <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Ex.: Automatizar 20 cenários de regressão."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              disabled={loading}
            />
            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Unidade <span className="text-destructive">*</span>
              </label>
              <Select value={unidade} onValueChange={(v) => setUnidade(v as OkrUnidadeDto)}>
                <SelectTrigger disabled={loading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {OKR_UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNIDADE_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>

            {unidade === "PERSONALIZADA" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Nome da unidade <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Ex.: Pontos"
                  value={unidadePersonalizada}
                  onChange={(e) => setUnidadePersonalizada(e.target.value)}
                  disabled={loading}
                />
                {errors.unidadePersonalizada && (
                  <p className="text-xs text-destructive">{errors.unidadePersonalizada}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Valor inicial</label>
              <Input
                type="number"
                min={0}
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                disabled={loading}
              />
              {errors.valorInicial && <p className="text-xs text-destructive">{errors.valorInicial}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Meta <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min={0}
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                disabled={loading}
              />
              {errors.meta && <p className="text-xs text-destructive">{errors.meta}</p>}
            </div>
          </div>

          {membros.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Responsáveis</label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border-default p-2">
                {membros.map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={responsaveis.includes(m.id)}
                      onChange={() => toggleResponsavel(m.id)}
                      disabled={loading}
                      className="accent-primary"
                    />
                    <span className="text-sm text-text-primary">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="gap-1.5">
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button type="submit" form="kr-form" disabled={loading} className="gap-1.5">
            {loading ? (
              <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
            ) : isEditing ? (
              <><Check className="size-4 shrink-0" aria-hidden />Salvar</>
            ) : (
              <><Check className="size-4 shrink-0" aria-hidden />Criar Key Result</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
