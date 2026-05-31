"use client"

import * as React from "react"
import { Check, Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { OkrEquipeMembro } from "@/features/okrs/actions/okrs"
import type { OkrIniciativaDto } from "@/features/okrs/lib/okrs-schemas"

interface OkrIniciativaFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { descricao: string; responsaveis: string[] }) => Promise<void>
  loading?: boolean
  membros: OkrEquipeMembro[]
  initial?: Pick<OkrIniciativaDto, "descricao" | "responsaveis">
}

export function OkrIniciativaFormModal({
  open,
  onClose,
  onSubmit,
  loading,
  membros,
  initial,
}: OkrIniciativaFormModalProps) {
  const [descricao, setDescricao] = React.useState(initial?.descricao ?? "")
  const [responsaveis, setResponsaveis] = React.useState<string[]>(
    initial?.responsaveis?.map((r) => r.userId) ?? [],
  )
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setDescricao(initial?.descricao ?? "")
      setResponsaveis(initial?.responsaveis?.map((r) => r.userId) ?? [])
      setError("")
    }
  }, [open])

  function toggleResponsavel(userId: string) {
    setResponsaveis((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descricao.trim()) { setError("Descrição é obrigatória."); return }
    setError("")
    await onSubmit({ descricao: descricao.trim(), responsaveis })
  }

  const isEditing = !!initial

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Iniciativa" : "Nova Iniciativa"}</DialogTitle>
        </DialogHeader>
        <form id="iniciativa-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Descrição <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Ex.: Definir critérios de aceite para automação."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              disabled={loading}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          {membros.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Responsáveis</label>
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-border-default p-2">
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
          <Button type="submit" form="iniciativa-form" disabled={loading} className="gap-1.5">
            {loading ? (
              <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
            ) : isEditing ? (
              <><Check className="size-4 shrink-0" aria-hidden />Salvar</>
            ) : (
              <><Check className="size-4 shrink-0" aria-hidden />Criar Iniciativa</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
