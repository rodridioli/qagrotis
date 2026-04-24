import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DashboardClient } from "./DashboardClient"
import { SistemaSelecionadoProvider } from "@/lib/modulo-context"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { SuiteDashboardRecord } from "@/lib/actions/suites"

const MOCK_SCENARIOS: CenarioRecord[] = Array.from({ length: 50 }, (_, i) => ({
  id: `CT-${String(i).padStart(3, "0")}`,
  scenarioName: `Cenário de Teste ${i}`,
  system: i % 2 === 0 ? "Plataforma AGRO" : "ERP Agro",
  module: "PRO - Produtor Rural",
  client: "Cliente demo",
  tipo: i % 5 === 0 ? "Automatizado" : "Manual",
  active: true,
  createdAt: Date.now() - ((i * 7919) % 1000000000),
  createdBy: i % 3 === 0 ? "Admin User" : "QA Analyst",
  execucoes: (i * 7) % 100,
  erros: (i * 3) % 10,
  suites: (i * 2) % 5,
}))

const allSuites: SuiteDashboardRecord[] = [
  {
    id: "S-01",
    sistema: "Plataforma AGRO",
    modulo: "PRO - Produtor Rural",
    historico: [
      {
        id: "CT-0",
        cenario: "Login",
        module: "PRO",
        tipo: "Manual",
        deps: 0,
        data: "10/04/2026",
        hora: "10:00",
        timestamp: Date.now(),
        resultado: "Sucesso",
      },
      {
        id: "CT-1",
        cenario: "Fluxo X",
        module: "PRO",
        tipo: "Manual",
        deps: 0,
        data: "10/04/2026",
        hora: "11:00",
        timestamp: Date.now() - 3_600_000,
        resultado: "Alerta",
        alertaObs: "Atenção ao campo Y",
      },
      {
        id: "CT-2",
        cenario: "Validação",
        module: "PRO",
        tipo: "Manual",
        deps: 0,
        data: "09/04/2026",
        hora: "15:00",
        timestamp: Date.now() - 86_400_000,
        resultado: "Erro",
      },
    ],
  },
]

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

export const Default: Story = {
  args: {
    allModulos: [
      { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
      { id: "M-02", name: "REC - Receituário", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
    ],
    allCenarios: MOCK_SCENARIOS,
    allUsers: [
      { id: "U-01", name: "Admin User", email: "admin@qagrotis.com.br", type: "Administrador", active: true, photoPath: null },
      { id: "U-02", name: "QA Analyst", email: "qa@qagrotis.com.br", type: "Padrão", active: true, photoPath: null },
    ],
    allSuites,
  },
}
