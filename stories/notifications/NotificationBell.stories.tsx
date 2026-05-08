import type { Meta, StoryObj } from "@storybook/nextjs-vite"

/**
 * NotificationBell depende de useSession (next-auth) e React Query.
 * As stories abaixo documentam os estados visuais isolados dos sub-componentes.
 *
 * Para testar o bell completo, use o app em desenvolvimento.
 */

import { NotificationItem } from "@/components/notifications/NotificationItem"
import { BellOff, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NotificationData } from "@/core/actions/notifications"

const mockItems: NotificationData[] = [
  {
    id: "1",
    type: "FEEDBACK",
    title: "Você recebeu um feedback",
    message: "Feedback positivo sobre sua apresentação no último chapter.",
    link: "/individual/feedbacks/1",
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: "2",
    type: "EVALUATION",
    title: "Avaliação finalizada",
    message: "Sua avaliação de desempenho do ciclo Q1 foi concluída.",
    link: "/avaliacao-desempenho/2",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
  {
    id: "3",
    type: "ACHIEVEMENT",
    title: "Conquista desbloqueada: 1 Ano",
    message: "Você completou 1 ano na empresa!",
    link: "/individual/conquistas",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
  },
]

const meta: Meta = {
  title: "Notifications/NotificationBell",
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Documentação dos estados visuais do sistema de notificações. O NotificationBell completo requer sessão ativa e React Query Provider — use o app para testá-lo em runtime.",
      },
    },
  },
}

export default meta

export const ListaComNotificacoes = {
  name: "Drawer — com notificações",
  render: () => (
    <div className="w-full sm:max-w-sm border border-border-default rounded-xl overflow-hidden bg-surface-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-base font-semibold text-text-primary">Notificações</span>
        <span className="text-xs text-text-secondary">3 não lidas</span>
      </div>
      <div>
        {mockItems.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onActivate={async () => { await new Promise((r) => setTimeout(r, 500)) }}
          />
        ))}
      </div>
    </div>
  ),
}

export const ListaVazia = {
  name: "Drawer — vazio",
  render: () => (
    <div className="w-full sm:max-w-sm border border-border-default rounded-xl overflow-hidden bg-surface-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-base font-semibold text-text-primary">Notificações</span>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <BellOff className="size-10 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">Nenhuma notificação por aqui.</p>
      </div>
    </div>
  ),
}

export const EstadoDeErro = {
  name: "Drawer — erro de rede",
  render: () => (
    <div className="w-full sm:max-w-sm border border-border-default rounded-xl overflow-hidden bg-surface-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-base font-semibold text-text-primary">Notificações</span>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <WifiOff className="size-8 text-text-secondary/30" />
        <p className="text-sm text-text-secondary">Não foi possível carregar as notificações.</p>
        <Button variant="outline" size="sm">Tentar novamente</Button>
      </div>
    </div>
  ),
}

export const EstadoLoading = {
  name: "Drawer — loading (skeletons)",
  render: () => (
    <div className="w-full sm:max-w-sm border border-border-default rounded-xl overflow-hidden bg-surface-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-base font-semibold text-text-primary">Notificações</span>
      </div>
      <div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-0">
            <div className="size-9 rounded-full bg-neutral-grey-100 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 pt-0.5">
              <div className="h-3 w-3/4 rounded bg-neutral-grey-100 animate-pulse" />
              <div className="h-3 w-full rounded bg-neutral-grey-100 animate-pulse" />
              <div className="h-3 w-1/4 rounded bg-neutral-grey-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
}

export const BadgeComContador = {
  name: "Bell — badge com contador",
  render: () => (
    <div className="flex items-center gap-8 p-8">
      {/* Sem badge */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        </button>
        <span className="text-xs text-text-secondary">0 notif.</span>
      </div>
      {/* Badge com número */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">3</span>
        </button>
        <span className="text-xs text-text-secondary">3 notif.</span>
      </div>
      {/* Badge 9+ */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex size-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">9+</span>
        </button>
        <span className="text-xs text-text-secondary">10+ notif.</span>
      </div>
    </div>
  ),
}
