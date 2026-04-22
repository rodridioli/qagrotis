import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipePerformanceCard } from "@/components/equipe/EquipePerformanceCard"
import type { UserPerformanceData } from "@/lib/actions/equipe"

const mockRodrigo: UserPerformanceData = {
  userId: "demo-1",
  name: "Rodrigo Diego de Oliveira",
  email: "rodrigo@example.com",
  classificacao: "Colaborador",
  photoPath: null,
  atividadePorSistema: [
    { sistema: "Gerencial", modulos: ["Sped"] },
    { sistema: "Plataforma", modulos: ["ARM", "REC"] },
    { sistema: "SAP-B1", modulos: ["Indústria"] },
  ],
  cenariosCriados: 22,
  testesExecutados: 0,
  errosEncontrados: 0,
  sucessos: 0,
  testesAutomatizados: 2,
  percentualAutomatizado: 9,
  score: 100,
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
  name: "Referência (card de performance)",
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
