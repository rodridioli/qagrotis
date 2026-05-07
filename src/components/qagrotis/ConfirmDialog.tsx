import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CancelActionButton } from "@/components/qagrotis/CancelActionButton"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  /** Ícone exibido à esquerda do label no botão de confirmação. */
  confirmIcon?: React.ReactNode
  /** Variante do botão de confirmação. Padrão: "destructive". */
  buttonVariant?: "default" | "destructive"
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmIcon,
  buttonVariant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary">{description}</p>
        <DialogFooter showCloseButton={false}>
          <CancelActionButton onClick={() => onOpenChange(false)} />
          <Button
            variant={buttonVariant}
            onClick={onConfirm}
            className="gap-1.5"
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
