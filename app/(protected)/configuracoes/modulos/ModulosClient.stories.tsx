import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import ModulosClient from "./ModulosClient"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { CenarioRecord } from "@/lib/actions/cenarios"

const modulos: ModuloRecord[] = [
  { id: "M-01", name: "Folha de Pagamento", sistemaId: "S-01", sistemaName: "Financeiro", description: "Processamento da folha", active: true, createdAt: Date.now() - 86400000 },
  { id: "M-02", name: "Contas a Pagar", sistemaId: "S-01", sistemaName: "Financeiro", description: null, active: true, createdAt: Date.now() - 3600000 },
  { id: "M-03", name: "Recrutamento", sistemaId: "S-02", sistemaName: "RH", description: "Processo seletivo", active: false, createdAt: Date.now() - 172800000 },
]

const cenarios: Partial<CenarioRecord>[] = [
  { module: "Folha de Pagamento", active: true },
  { module: "Folha de Pagamento", active: true },
  { module: "Folha de Pagamento", active: false },
]

const meta: Meta<typeof ModulosClient> = {
  title: "Configurações/ModulosClient",
  component: ModulosClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Tabela de módulos com sistema associado, contagem de cenários, busca, filtro e inativação em lote.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ModulosClient>

export const Admin: Story = {
  name: "Visão de administrador",
  args: {
    initialModulos: modulos,
    initialCenarios: cenarios as CenarioRecord[],
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão",
  args: {
    initialModulos: modulos,
    initialCenarios: cenarios as CenarioRecord[],
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialModulos: [],
    initialCenarios: [],
    isAdmin: true,
  },
}

export const NomesLongos: Story = {
  name: "Nomes longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Valida sticky left (Código) e sticky right (ações) ao rolar horizontalmente. Hover em Nome, Sistema e Descrição exibe o texto completo via tooltip nativo.",
      },
    },
  },
  args: {
    initialModulos: [
      { id: "M-001", name: "Processamento Automático da Folha de Pagamento Mensal", sistemaId: "S-01", sistemaName: "Sistema Integrado de Gestão Agropecuária", description: "Cálculo completo de folha incluindo benefícios, impostos e encargos trabalhistas", active: true, createdAt: Date.now() },
      { id: "M-002", name: "Gestão de Contas a Pagar e Receber", sistemaId: "S-01", sistemaName: "Sistema Integrado de Gestão Agropecuária", description: null, active: true, createdAt: Date.now() - 1000 },
    ],
    initialCenarios: [
      { module: "Processamento Automático da Folha de Pagamento Mensal", active: true } as any,
      { module: "Processamento Automático da Folha de Pagamento Mensal", active: true } as any,
    ],
    isAdmin: true,
  },
}
