import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipePerformanceCard } from "@/features/equipe/components/EquipePerformanceCard"
import type { UserPerformanceData } from "@/features/equipe/actions/equipe"

const mockRodrigo: UserPerformanceData = {
  userId: "demo-1",
  name: "Rodrigo Diego de Oliveira",
  email: "rodrigo@example.com",
  accessProfile: "QA",
  classificacao: "Colaborador",
  photoPath: null,
  atividadePorSistema: [
    { sistema: "Gerencial", modulos: [{ name: "Sped", count: 3 }] },
    { sistema: "Plataforma", modulos: [{ name: "ARM", count: 5 }, { name: "REC", count: 2 }] },
    { sistema: "SAP-B1", modulos: [{ name: "Indústria", count: 1 }] },
  ],
  cenariosCriados: 22,
  testesExecutados: 0,
  errosEncontrados: 0,
  sucessos: 0,
  testesAutomatizados: 2,
  percentualAutomatizado: 9,
  score: 100,
}

const mockMgr: UserPerformanceData = {
  userId: "demo-mgr",
  name: "Ana Lúcia Ferreira",
  email: "ana@example.com",
  accessProfile: "MGR",
  classificacao: "Gestora",
  photoPath: null,
  atividadePorSistema: [],
  cenariosCriados: 0,
  testesExecutados: 0,
  errosEncontrados: 0,
  sucessos: 0,
  testesAutomatizados: 0,
  percentualAutomatizado: 0,
  score: 0,
  perfilCounts: [
    { label: "MGR", count: 2 },
    { label: "QA",  count: 8 },
    { label: "UX",  count: 3 },
    { label: "TW",  count: 2 },
  ],
}

const meta = {
  title: "Equipe/EquipePerformanceCard",
  component: EquipePerformanceCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EquipePerformanceCard>

export default meta
type Story = StoryObj<typeof meta>

export const ReferenciaVisual: Story = {
  name: "Referência QA (card de performance)",
  args: {
    user: mockRodrigo,
    rank: 1,
  },
  decorators: [
    (StoryEl) => (
      <div className="w-full max-w-sm bg-surface-default p-4">
        <StoryEl />
      </div>
    ),
  ],
}

export const SemFoto: Story = {
  args: {
    user: mockRodrigo,
    rank: 2,
  },
  decorators: ReferenciaVisual.decorators,
}

export const SemAtividadeSistema: Story = {
  args: {
    user: {
      ...mockRodrigo,
      atividadePorSistema: [],
    },
    rank: 3,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardMGR: Story = {
  name: "Card MGR (Feedbacks/Avaliações/Domínio 60%)",
  args: {
    user: mockMgr,
    rank: 1,
  },
  decorators: ReferenciaVisual.decorators,
}
