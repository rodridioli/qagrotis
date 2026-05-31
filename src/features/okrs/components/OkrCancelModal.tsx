"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface OkrCancelModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => Promise<void>
  titulo: string
  descricao?: string
  loading?: boolean
}

export function OkrCancelModal({
  open,
  onClose,
  onConfirm,
  titulo,
  descricao,
  loading,
}: OkrCancelModalProps) {
  const [motivo, setMotivo] = React.useState("")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!open) {
      setMotivo("")
      setError("")
    }
  }, [open])

  async function handleConfirm() {
    if (!motivo.trim()) {
      setError("Motivo é obrigatório.")
      return
    }
    setError("")
    await onConfirm(motivo.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {descricao && (
          <p className="text-sm text-text-secondary">{descricao}</p>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Motivo do cancelamento <span className="text-destructive">*</span>
          </label>
          <Textarea
            placeholder="Descreva o motivo..."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            disabled={loading}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
