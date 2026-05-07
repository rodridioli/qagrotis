import { cn } from "@/lib/utils"

interface SectionSpinnerProps {
  /** Texto exibido abaixo do spinner. Padrão: "Carregando…" */
  label?: string
  /** Classes extras no container externo. */
  className?: string
  /** Altura mínima do container. Padrão: min-h-[12rem] */
  minHeight?: string
}

/**
 * Spinner padronizado para estados de loading dentro de seções e cards.
 * Use para substituir `<p>Carregando…</p>` em blocos de conteúdo assíncronos.
 *
 * Para overlays fullscreen use `LoadingOverlay`.
 * Para spinners inline em botões use `Loader2` do lucide-react.
 *
 * @example
 * {loading ? <SectionSpinner /> : <Content />}
 */
export function SectionSpinner({
  label = "Carregando…",
  className,
  minHeight = "min-h-[12rem]",
}: SectionSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex items-center justify-center gap-2.5 py-12",
        minHeight,
        className,
      )}
    >
      <span
        className="size-5 animate-spin rounded-full border-[3px] border-brand-primary/20 border-t-brand-primary"
        aria-hidden="true"
      />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  )
}
