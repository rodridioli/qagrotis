"use client"

import { cn } from "@/core/utils"

interface LoadingOverlayProps {
  visible: boolean
  label?: string
  className?: string
}

/**
 * Overlay de loading que cobre apenas a área de conteúdo (absolute inset-0),
 * posicionado em relação ao <main className="relative"> do LayoutClient.
 * Sidebar e topbar permanecem visíveis. Visual idêntico ao SectionSpinner.
 *
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
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 py-12",
        "bg-surface-default",
        className
      )}
    >
      <span
        className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary"
        aria-hidden="true"
      />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
