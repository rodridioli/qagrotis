import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import SistemasClient from "./SistemasClient"
import type { SistemaRecord } from "@/lib/actions/sistemas"
import type { ModuloRecord } from "@/lib/actions/modulos"

const sistemas: SistemaRecord[] = [
  { id: "S-01", name: "Financeiro", description: "Módulo financeiro da empresa", active: true, createdAt: Date.now() - 86400000 },
  { id: "S-02", name: "RH", description: null, active: true, createdAt: Date.now() - 3600000 },
  { id: "S-03", name: "Legacy", description: "Sistema antigo", active: false, createdAt: Date.now() - 172800000 },
]

const modulos: ModuloRecord[] = [
  { id: "M-01", name: "Folha de Pagamento", sistemaId: "S-01", sistemaName: "Financeiro", description: null, active: true, createdAt: Date.now() },
  { id: "M-02", name: "Contas a Pagar", sistemaId: "S-01", sistemaName: "Financeiro", description: null, active: true, createdAt: Date.now() },
  { id: "M-03", name: "Recrutamento", sistemaId: "S-02", sistemaName: "RH", description: null, active: true, createdAt: Date.now() },
]

const meta: Meta<typeof SistemasClient> = {
  title: "Configurações/SistemasClient",
  component: SistemasClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Tabela de sistemas com módulos associados, busca, filtro e inativação em lote.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof SistemasClient>

export const Admin: Story = {
  name: "Visão de administrador",
  args: {
    initialSistemas: sistemas,
    initialModulos: modulos,
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão (sem ações admin)",
  args: {
    initialSistemas: sistemas,
    initialModulos: modulos,
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialSistemas: [],
    initialModulos: [],
    isAdmin: true,
  },
}

export const SemModulos: Story = {
  name: "Sistemas sem módulos associados",
  args: {
    initialSistemas: [
      { id: "S-01", name: "Novo Sistema", description: "Recém criado", active: true, createdAt: Date.now() },
    ],
    initialModulos: [],
    isAdmin: true,
  },
}

export const NomesLongos: Story = {
  name: "Nomes longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Valida sticky left (Código) e sticky right (ações). Hover em Nome e Descrição exibe o texto completo via tooltip nativo. O botão de módulos exibe aria-label descritivo.",
      },
    },
  },
  args: {
    initialSistemas: [
      { id: "S-001", name: "Sistema Integrado de Gestão Agropecuária e Rastreabilidade", description: "Plataforma central de gestão agropecuária com rastreabilidade completa da cadeia produtiva", active: true, createdAt: Date.now() },
      { id: "S-002", name: "ERP Financeiro e Contábil para Cooperativas Rurais", description: null, active: true, createdAt: Date.now() - 1000 },
    ],
    initialModulos: [
      { id: "M-01", name: "Folha", sistemaId: "S-001", sistemaName: "Sistema Integrado", description: null, active: true, createdAt: Date.now() },
      { id: "M-02", name: "Estoque", sistemaId: "S-001", sistemaName: "Sistema Integrado", description: null, active: true, createdAt: Date.now() },
    ],
    isAdmin: true,
  },
}
