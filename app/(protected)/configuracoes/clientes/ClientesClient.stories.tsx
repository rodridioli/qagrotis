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
        component: "Tabela de clientes com sistemas associados, modal de adição rápida, busca, filtro e inativação em lote. CPF/CNPJ é validado por dígito verificador antes de salvar.",
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
      { client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.", system: "Financeiro", active: true } as any,
      { client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.", system: "RH", active: true } as any,
      { client: "Empresa de Tecnologia Agropecuária do Brasil Ltda.", system: "CRM", active: true } as any,
    ],
    isAdmin: true,
  },
}
