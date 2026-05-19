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
  alertas: 2,
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
  alertas: 0,
  sucessos: 0,
  testesAutomatizados: 0,
  percentualAutomatizado: 0,
  score: 0,
  feedbacksCount: 12,
  avaliacoesCount: 4,
}

const mockUX: UserPerformanceData = {
  userId: "demo-ux",
  name: "Carla Mendes",
  email: "carla@example.com",
  accessProfile: "UX",
  classificacao: "Designer UX",
  photoPath: null,
  atividadePorSistema: [],
  atividadePorProjeto: [
    { projectName: "Agro Digital", jirasCount: 12 },
    { projectName: "SAP Core", jirasCount: 8 },
  ],
  cenariosCriados: 5,   // newPrototypesCount
  testesExecutados: 2,  // researchCount
  sucessos: 7,          // adjustmentsCount
  errosEncontrados: 1,  // usabilityCount
  alertas: 0,
  testesAutomatizados: 0,
  percentualAutomatizado: 32, // returnRatePercent
  newPrototypesCount: 5,
  adjustmentsCount: 7,
  returnRatePercent: 32,
  score: 0,
}

const mockTW: UserPerformanceData = {
  userId: "demo-tw",
  name: "Lucas Tavares",
  email: "lucas@example.com",
  accessProfile: "TW",
  classificacao: "Technical Writer",
  photoPath: null,
  atividadePorSistema: [],
  atividadePorProjeto: [
    { projectName: "Docs Portal", jirasCount: 9 },
    { projectName: "Release Notes", jirasCount: 4 },
    { projectName: "API Reference", jirasCount: 2 },
  ],
  cenariosCriados: 6,  // newDocCount
  testesExecutados: 3, // docReviewCount
  sucessos: 2,         // othersCount
  errosEncontrados: 0,
  alertas: 0,
  testesAutomatizados: 0,
  percentualAutomatizado: 0,
  othersCount: 2,
  score: 0,
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
  name: "Card MGR (2 caixas: Feedbacks + Avaliações)",
  args: {
    user: mockMgr,
    rank: 1,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardMGRSemDados: Story = {
  name: "Card MGR — sem registros no período",
  args: {
    user: { ...mockMgr, feedbacksCount: 0, avaliacoesCount: 0 },
    rank: 2,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardUX: Story = {
  name: "Card UX (Novos Protótipos / Pesquisa / Ajustes / Usabilidade / Taxa de Retorno)",
  args: {
    user: mockUX,
    rank: 1,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardUXSemJira: Story = {
  name: "Card UX — sem dados Jira (zeros + traços)",
  args: {
    user: {
      ...mockUX,
      atividadePorProjeto: [],
      cenariosCriados: 0,
      testesExecutados: 0,
      sucessos: 0,
      errosEncontrados: 0,
      percentualAutomatizado: 0,
    },
    rank: 3,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardTW: Story = {
  name: "Card TW (Novos / Revisões / Outros + projetos Jira)",
  args: {
    user: mockTW,
    rank: 1,
  },
  decorators: ReferenciaVisual.decorators,
}

export const CardTWSemJira: Story = {
  name: "Card TW — sem dados Jira (zeros + traços)",
  args: {
    user: {
      ...mockTW,
      atividadePorProjeto: [],
      cenariosCriados: 0,
      testesExecutados: 0,
      sucessos: 0,
    },
    rank: 2,
  },
  decorators: ReferenciaVisual.decorators,
}
