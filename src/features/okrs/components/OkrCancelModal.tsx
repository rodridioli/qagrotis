"use client"

import * as React from "react"
import { Ban, Loader2, X } from "lucide-react"
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
            Motivo <span className="text-destructive">*</span>
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
          <Button variant="outline" onClick={onClose} disabled={loading} className="gap-1.5">
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading} className="gap-1.5">
            {loading ? (
              <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Cancelando…</>
            ) : (
              <><Ban className="size-4 shrink-0" aria-hidden />Confirmar cancelamento</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
