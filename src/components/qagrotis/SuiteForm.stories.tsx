
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
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
  { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
  { id: "M-02", name: "REC - Receituário", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
]

const MOCK_CENARIOS = [
  { id: "CT-001", scenarioName: "Login básico", system: "Plataforma AGRO", module: "PRO - Produtor Rural", tipo: "Manual", active: true, description: null, moduleId: "M-01", client: "Agrotis", execucoes: 0, erros: 0, suites: 0 },
  { id: "CT-002", scenarioName: "Cadastro de cliente", system: "Plataforma AGRO", module: "REC - Receituário", tipo: "Automatizado", active: true, description: null, moduleId: "M-02", client: "Agrotis", execucoes: 0, erros: 0, suites: 0 },
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
      cliente: "Agrotis",
      objetivo: "Validar regressão geral",
      active: true,
      encerrada: false,
      createdAt: Date.now(),
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
