import { cn } from "@/core/utils"

interface SectionSpinnerProps {
  /** Texto exibido abaixo do spinner. Padrão: "Carregando…" */
  label?: string
  /** Classes extras no container externo. */
  className?: string
  /** Altura mínima do container. Padrão: min-h-[12rem] */
  minHeight?: string
  /** Tamanho do spinner. Padrão: "md" */
  size?: "sm" | "md" | "lg"
}

export function SectionSpinner({
  label = "Carregando…",
  className,
  minHeight = "min-h-[12rem]",
  size = "md",
}: SectionSpinnerProps) {
  const spinnerCls = cn(
    "animate-spin rounded-full border-brand-primary/20 border-t-brand-primary",
    size === "sm" && "size-4 border-2",
    size === "md" && "size-5 border-[3px]",
    size === "lg" && "size-8 border-4",
  )
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 py-12",
        minHeight,
        className,
      )}
    >
      <span className={spinnerCls} aria-hidden="true" />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
