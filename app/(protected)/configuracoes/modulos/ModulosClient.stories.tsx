import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import ModulosClient from "./ModulosClient"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { SistemaRecord } from "@/lib/actions/sistemas"

const modulos: ModuloRecord[] = [
  { id: "M-01", name: "Folha de Pagamento", sistemaId: "S-01", sistemaName: "Financeiro", description: "Processamento da folha", active: true, createdAt: Date.now() - 86400000 },
  { id: "M-02", name: "Contas a Pagar", sistemaId: "S-01", sistemaName: "Financeiro", description: null, active: true, createdAt: Date.now() - 3600000 },
  { id: "M-03", name: "Recrutamento", sistemaId: "S-02", sistemaName: "RH", description: "Processo seletivo", active: false, createdAt: Date.now() - 172800000 },
]

const sistemas: SistemaRecord[] = [
  { id: "S-01", name: "Financeiro", description: null, active: true, createdAt: Date.now() - 86400000 },
  { id: "S-02", name: "RH", description: null, active: true, createdAt: Date.now() - 86400000 },
]

const cenarios: CenarioRecord[] = [
  {
    id: "CT-01",
    scenarioName: "Login",
    module: "Folha de Pagamento",
    system: "Financeiro",
    client: "Acme Corp",
    execucoes: 2,
    erros: 0,
    suites: 1,
    tipo: "Manual",
    active: true,
  },
  {
    id: "CT-02",
    scenarioName: "Folha",
    module: "Folha de Pagamento",
    system: "Financeiro",
    client: "Acme Corp",
    execucoes: 5,
    erros: 1,
    suites: 2,
    tipo: "Automatizado",
    active: true,
  },
  {
    id: "CT-03",
    scenarioName: "Inativo",
    module: "Folha de Pagamento",
    system: "Financeiro",
    client: "Acme Corp",
    execucoes: 0,
    erros: 0,
    suites: 0,
    tipo: "Manual",
    active: false,
  },
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
    initialCenarios: cenarios,
    initialSistemas: sistemas,
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão",
  args: {
    initialModulos: modulos,
    initialCenarios: cenarios,
    initialSistemas: sistemas,
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialModulos: [],
    initialCenarios: [],
    initialSistemas: [],
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
      {
        id: "CT-101",
        scenarioName: "Cenário longo 1",
        module: "Processamento Automático da Folha de Pagamento Mensal",
        system: "Sistema Integrado de Gestão Agropecuária",
        client: "Cliente demo",
        execucoes: 1,
        erros: 0,
        suites: 0,
        tipo: "Manual",
        active: true,
      },
      {
        id: "CT-102",
        scenarioName: "Cenário longo 2",
        module: "Processamento Automático da Folha de Pagamento Mensal",
        system: "Sistema Integrado de Gestão Agropecuária",
        client: "Cliente demo",
        execucoes: 2,
        erros: 0,
        suites: 1,
        tipo: "Manual",
        active: true,
      },
    ],
    initialSistemas: [
      { id: "S-01", name: "Sistema Integrado de Gestão Agropecuária", description: null, active: true, createdAt: Date.now() },
    ],
    isAdmin: true,
  },
}
