import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import ClientesClient from "./ClientesClient"
import type { ClienteRecord } from "@/lib/actions/clientes"
import type { CenarioRecord } from "@/lib/actions/cenarios"

const clientes: ClienteRecord[] = [
  { id: "C-01", nomeFantasia: "Acme Corp", razaoSocial: "Acme Comércio Ltda", cpfCnpj: "11.222.333/0001-81", active: true, createdAt: Date.now() - 86400000 },
  { id: "C-02", nomeFantasia: "Beta Tech", razaoSocial: null, cpfCnpj: null, active: true, createdAt: Date.now() - 3600000 },
  { id: "C-03", nomeFantasia: "Gamma Foods", razaoSocial: "Gamma Alimentos SA", cpfCnpj: "529.982.247-25", active: false, createdAt: Date.now() - 172800000 },
]

const cenarios: Partial<CenarioRecord>[] = [
  { client: "Acme Corp", system: "Financeiro", active: true },
  { client: "Acme Corp", system: "RH", active: true },
  { client: "Beta Tech", system: "Financeiro", active: true },
]

const meta: Meta<typeof ClientesClient> = {
  title: "Configurações/ClientesClient",
  component: ClientesClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Tabela de clientes com sistemas associados. Criação e edição via modal inline (sem navegação de página). CPF/CNPJ é validado por dígito verificador antes de salvar. Suporta busca, filtro e inativação em lote.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ClientesClient>

export const Admin: Story = {
  name: "Visão de administrador",
  args: {
    initialClientes: clientes,
    initialCenarios: cenarios as CenarioRecord[],
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão",
  args: {
    initialClientes: clientes,
    initialCenarios: cenarios as CenarioRecord[],
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialClientes: [],
    initialCenarios: [],
    isAdmin: true,
  },
}

export const SemSistemas: Story = {
  name: "Clientes sem sistemas associados",
  args: {
    initialClientes: [
      { id: "C-01", nomeFantasia: "Novo Cliente", razaoSocial: null, cpfCnpj: null, active: true, createdAt: Date.now() },
    ],
    initialCenarios: [],
    isAdmin: true,
  },
}

export const EdicaoModal: Story = {
  name: "Modal de edição — abre ao clicar no Código ou em Editar",
  parameters: {
    docs: {
      description: {
        story: "Clicar no código do cliente (CLI-xx) ou em Editar no dropdown abre a modal de edição inline com os dados pré-preenchidos. Não há navegação para outra página.",
      },
    },
  },
  args: {
    initialClientes: [
      { id: "CLI-01", nomeFantasia: "Acme Corp", razaoSocial: "Acme Comércio Ltda", cpfCnpj: "11.222.333/0001-81", active: true, createdAt: Date.now() },
    ],
    initialCenarios: [],
    isAdmin: true,
  },
}

export const NomesLongos: Story = {
  name: "Nomes longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Valida colunas fixas (sticky left/right) e tooltip nativo em células truncadas. Role horizontalmente para ver Código fixo à esquerda e ações fixas à direita.",
      },
    },
  },
  args: {
    initialClientes: [
      { id: "C-001", nomeFantasia: "Empresa de Tecnologia Agropecuária do Brasil Ltda.", razaoSocial: "ET Agro Brasil Comércio e Industria de Tecnologia SA", cpfCnpj: "11.222.333/0001-81", active: true, createdAt: Date.now() },
      { id: "C-002", nomeFantasia: "Agrosoluções Digitais Integradas do Centro-Oeste", razaoSocial: null, cpfCnpj: "529.982.247-25", active: true, createdAt: Date.now() - 1000 },
    ],
    initialCenarios: [
      {
        id: "CT-901",
        scenarioName: "Fluxo A",
        module: "M1",
        system: "Financeiro",
        client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.",
        execucoes: 0,
        erros: 0,
        suites: 0,
        tipo: "Manual",
        active: true,
      },
      {
        id: "CT-902",
        scenarioName: "Fluxo B",
        module: "M2",
        system: "RH",
        client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.",
        execucoes: 0,
        erros: 0,
        suites: 0,
        tipo: "Manual",
        active: true,
      },
      {
        id: "CT-903",
        scenarioName: "Fluxo C",
        module: "M3",
        system: "CRM",
        client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.",
        execucoes: 0,
        erros: 0,
        suites: 0,
        tipo: "Manual",
        active: true,
      },
    ] satisfies CenarioRecord[],
    isAdmin: true,
  },
}
