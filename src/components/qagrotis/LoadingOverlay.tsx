"use client"

import { cn } from "@/lib/utils"

interface LoadingOverlayProps {
  visible: boolean
  label?: string
  className?: string
}

/**
 * Full-screen semi-transparent overlay with a centered spinner.
 * Usage: <LoadingOverlay visible={isSaving} label="Salvando..." />
 */
export function LoadingOverlay({ visible, label = "Processando...", className }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3",
        "bg-surface-default/70 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-card shadow-card">
        <span className="size-6 animate-spin rounded-full border-[3px] border-brand-primary border-t-transparent" />
      </div>
      <p className="text-sm font-medium text-text-primary">{label}</p>
    </div>
  )
}
