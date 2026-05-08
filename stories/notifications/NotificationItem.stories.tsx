import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { NotificationItem } from "@/components/notifications/NotificationItem"
import type { NotificationData } from "@/core/actions/notifications"

const now = new Date().toISOString()
const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString()
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString()

const mockFeedback: NotificationData = {
  id: "1",
  type: "FEEDBACK",
  title: "Você recebeu um feedback",
  message: "João enviou um feedback positivo sobre sua apresentação no chapter de boas práticas.",
  link: "/individual/feedbacks/abc123",
  createdAt: fiveMinutesAgo,
}

const mockEvaluation: NotificationData = {
  id: "2",
  type: "EVALUATION",
  title: "Avaliação de desempenho finalizada",
  message: "Sua avaliação de desempenho do ciclo Q1 2026 foi concluída e está disponível para visualização.",
  link: "/avaliacao-desempenho/xyz456",
  createdAt: twoHoursAgo,
}

const mockProgression: NotificationData = {
  id: "3",
  type: "PROGRESSION",
  title: "Progressão de carreira registrada",
  message: "Você foi promovido para Sênior QA. Parabéns pelo crescimento!",
  link: "/individual/progressao",
  createdAt: threeDaysAgo,
}

const mockAchievement: NotificationData = {
  id: "4",
  type: "ACHIEVEMENT",
  title: "Conquista desbloqueada: 1 Ano",
  message: "Você completou 1 ano na empresa. Um marco importante na sua jornada!",
  link: "/individual/conquistas",
  createdAt: now,
}

const meta: Meta<typeof NotificationItem> = {
  title: "Notifications/NotificationItem",
  component: NotificationItem,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Item individual de notificação com ícone tipado, prévia de mensagem e tempo decorrido. Ao clicar, executa fade-out e chama onActivate.",
      },
    },
  },
  args: {
    onActivate: async () => { await new Promise((r) => setTimeout(r, 500)) },
  },
}

export default meta
type Story = StoryObj<typeof NotificationItem>

export const Feedback: Story = {
  name: "Tipo: Feedback",
  args: { notification: mockFeedback },
}

export const Avaliacao: Story = {
  name: "Tipo: Avaliação",
  args: { notification: mockEvaluation },
}

export const Progressao: Story = {
  name: "Tipo: Progressão",
  args: { notification: mockProgression },
}

export const Conquista: Story = {
  name: "Tipo: Conquista (agora)",
  args: { notification: mockAchievement },
}

export const SemLink: Story = {
  name: "Sem link de navegação",
  args: {
    notification: { ...mockFeedback, id: "5", link: null },
  },
  parameters: {
    docs: {
      description: { story: "Quando link é null, ao clicar apenas executa onActivate sem navegar." },
    },
  },
}
