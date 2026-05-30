import { PlugZap } from "lucide-react"

interface Props {
  type: "jira" | "clockwork"
}

const TEXTS = {
  jira: {
    title: "Integração com Jira não configurada",
    description: "Configure sua conta Jira para visualizar os lançamentos e estatísticas de trabalho.",
  },
  clockwork: {
    title: "Integração com Clockwork não configurada",
    description: "Configure a integração Clockwork para acessar os dados de lançamentos.",
  },
} as const

export function IntegrationNotConfiguredCard({ type }: Props) {
  const { title, description } = TEXTS[type]

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border-default bg-surface-card py-16 text-center shadow-card"
      role="status"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-badge-warning/10">
        <PlugZap className="size-7 text-badge-warning-text" aria-hidden />
      </span>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <a
        href="/configuracoes"
        className="inline-flex items-center gap-2 rounded-custom border border-border-default bg-surface-input px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        Ir para Configurações
      </a>
    </div>
  )
}
