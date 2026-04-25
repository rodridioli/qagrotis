"use client"

import { AlertCircle, PlusCircle, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CommandBarConfirmProps {
  actionType: "create" | "update" | "delete"
  label: string
  details: string[]
  onConfirm: () => void
  onCancel: () => void
  isConfirming: boolean
}

const ACTION_CONFIG = {
  create: {
    icon: PlusCircle,
    borderColor: "border-l-green-500",
    iconColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
  },
  update: {
    icon: Pencil,
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  delete: {
    icon: AlertCircle,
    borderColor: "border-l-destructive",
    iconColor: "text-destructive",
    bgColor: "bg-destructive/10",
  },
}

export function CommandBarConfirm({ actionType, label, details, onConfirm, onCancel, isConfirming }: CommandBarConfirmProps) {
  const config = ACTION_CONFIG[actionType]
  const Icon = config.icon

  return (
    <div
      className={cn("m-3 rounded-md border border-border-default border-l-4 p-3", config.borderColor)}
      data-testid="command-bar-confirm"
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", config.bgColor)}>
          <Icon className={cn("size-3.5", config.iconColor)} aria-hidden="true" />
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          {details.length > 0 && (
            <ul className="space-y-0.5">
              {details.map((detail) => (
                <li key={detail} className="flex items-start gap-1.5 text-xs text-text-secondary">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-grey-400/40" aria-hidden="true" />
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onConfirm}
          disabled={isConfirming}
          data-testid="command-bar-confirm-btn"
          aria-label={`Confirmar: ${label}`}
        >
          {isConfirming && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          Confirmar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isConfirming}
          data-testid="command-bar-cancel-btn"
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
