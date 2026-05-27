import { PlugZap } from "lucide-react"

/**
 * Empty-state padrão exibido quando as credenciais Jira não estão configuradas.
 * Usado em qualquer tela que dependa da integração Jira (Kanban, Lançamentos, etc.).
 */
export function JiraNotConfiguredCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border-default bg-surface-card py-16 text-center shadow-card">
      <span className="flex size-14 items-center justify-center rounded-full bg-badge-warning/10">
        <PlugZap className="size-7 text-badge-warning-text" aria-hidden />
      </span>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-text-primary">Integração com Jira não configurada</p>
        <p className="mt-1 text-sm text-text-secondary">
          Configure sua conta Jira para visualizar os lançamentos e estatísticas de trabalho.
        </p>
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
