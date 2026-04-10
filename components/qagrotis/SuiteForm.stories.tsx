
import type { Meta, StoryObj } from "@storybook/react"
import { SuiteForm } from "./SuiteForm"
import { SistemaSelecionadoProvider } from "@/lib/modulo-context"

const meta: Meta<typeof SuiteForm> = {
  title: "QAgrotis/SuiteForm",
  component: SuiteForm,
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
type Story = StoryObj<typeof SuiteForm>

const MOCK_MODULOS = [
  { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true },
  { id: "M-02", name: "REC - Receituário", sistemaName: "Plataforma AGRO", active: true },
]

const MOCK_CENARIOS = [
  { id: "CT-001", scenarioName: "Login básico", system: "Plataforma AGRO", module: "PRO - Produtor Rural", tipo: "Manual", active: true },
  { id: "CT-002", scenarioName: "Cadastro de cliente", system: "Plataforma AGRO", module: "REC - Receituário", tipo: "Automatizado", active: true },
]

export const CreateMode: Story = {
  args: {
    mode: "create",
    systemList: ["Plataforma AGRO", "ERP Agro"],
    allModulos: MOCK_MODULOS,
    allCenarios: MOCK_CENARIOS
  }
}

export const EditMode: Story = {
  args: {
    mode: "edit",
    suite: {
      id: "S-0001",
      suiteName: "Regressão Mensal",
      versao: "1.2.0",
      sistema: "Plataforma AGRO",
      modulo: "PRO - Produtor Rural",
      tipo: "Manual",
      active: true,
      createdAt: new Date(),
      cenarios: [
        { id: "CT-001", name: "Login básico", module: "PRO - Produtor Rural", tipo: "Manual", execucoes: 10, erros: 2, deps: 1 }
      ],
      historico: [
        { id: "CT-001", cenario: "Login básico", module: "PRO - Produtor Rural", tipo: "Manual", deps: 1, data: "10/04/2026", hora: "14:00", timestamp: Date.now(), resultado: "Sucesso" }
      ]
    },
    systemList: ["Plataforma AGRO", "ERP Agro"],
    allModulos: MOCK_MODULOS,
    allCenarios: MOCK_CENARIOS
  }
}
