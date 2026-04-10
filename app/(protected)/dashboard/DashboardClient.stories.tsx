
import type { Meta, StoryObj } from "@storybook/react"
import { DashboardClient } from "./DashboardClient"
import { SistemaSelecionadoProvider } from "@/lib/modulo-context"

const meta: Meta<typeof DashboardClient> = {
  title: "Pages/Dashboard",
  component: DashboardClient,
  decorators: [
    (Story) => (
      <SistemaSelecionadoProvider>
        <Story />
      </SistemaSelecionadoProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof DashboardClient>

const MOCK_SCENARIOS = Array.from({ length: 50 }, (_, i) => ({
  id: `CT-${i}`,
  scenarioName: `Cenário de Teste ${i}`,
  system: i % 2 === 0 ? "Plataforma AGRO" : "ERP Agro",
  module: "PRO - Produtor Rural",
  tipo: i % 5 === 0 ? "Automatizado" : "Manual",
  active: true,
  createdAt: Date.now() - Math.random() * 1000000000,
  createdBy: i % 3 === 0 ? "Admin User" : "QA Analyst",
  execucoes: Math.floor(Math.random() * 100),
  erros: Math.floor(Math.random() * 10),
  suites: Math.floor(Math.random() * 5),
}))

export const Default: Story = {
  args: {
    allSistemas: ["Plataforma AGRO", "ERP Agro"],
    allModulos: [
      { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
      { id: "M-02", name: "REC - Receituário", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
    ],
    // @ts-ignore - mock simplicity
    allCenarios: MOCK_SCENARIOS,
    allUsers: [
      { id: "U-01", name: "Admin User", email: "admin@qagrotis.com.br", type: "Administrador", active: true, photoPath: null },
      { id: "U-02", name: "QA Analyst", email: "qa@qagrotis.com.br", type: "Padrão", active: true, photoPath: null },
    ],
    suitesWithHistory: [
      {
        id: "S-01",
        suiteName: "Regressão",
        sistema: "Plataforma AGRO",
        modulo: "PRO - Produtor Rural",
        historico: [
          { id: "CT-0", cenario: "Login", module: "PRO", tipo: "Manual", deps: 0, data: "10/04/2026", hora: "10:00", timestamp: Date.now(), resultado: "Sucesso" }
        ]
      }
    ]
  }
}
