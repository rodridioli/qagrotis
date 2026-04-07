import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import UsuariosClient from "./UsuariosClient"
import type { QaUserRecord } from "@/lib/actions/usuarios"

const base: QaUserRecord[] = [
  { id: "U-01", name: "Ana Silva", email: "ana@empresa.com", type: "Administrador", active: true, photoPath: null, createdAt: Date.now() - 86400000 },
  { id: "U-02", name: "Bruno Costa", email: "bruno@empresa.com", type: "Padrão", active: true, photoPath: null, createdAt: Date.now() - 3600000 },
  { id: "U-03", name: "Carla Dias", email: "carla@empresa.com", type: "Padrão", active: false, photoPath: null, createdAt: Date.now() - 7200000 },
]

const meta: Meta<typeof UsuariosClient> = {
  title: "Configurações/UsuariosClient",
  component: UsuariosClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Tabela de usuários com busca, filtro, seleção em lote e inativação.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof UsuariosClient>

export const Admin: Story = {
  name: "Visão de administrador",
  args: {
    initialUsers: base,
    currentUserId: "U-01",
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão (sem ações admin)",
  args: {
    initialUsers: base,
    currentUserId: "U-02",
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialUsers: [],
    currentUserId: "U-01",
    isAdmin: true,
  },
}

export const UltimoAdmin: Story = {
  name: "Último admin ativo (inativar bloqueado)",
  args: {
    initialUsers: [
      { id: "U-01", name: "Único Admin", email: "admin@empresa.com", type: "Administrador", active: true, photoPath: null, createdAt: Date.now() },
      { id: "U-02", name: "Padrão User", email: "user@empresa.com", type: "Padrão", active: true, photoPath: null, createdAt: Date.now() },
    ],
    currentUserId: "U-99",
    isAdmin: true,
  },
}

export const ApenasInativos: Story = {
  name: "Lista apenas com inativos",
  args: {
    initialUsers: [
      { id: "U-03", name: "Inativo", email: "inativo@empresa.com", type: "Padrão", active: false, photoPath: null, createdAt: Date.now() },
    ],
    currentUserId: "U-01",
    isAdmin: true,
  },
}

export const NomesLongos: Story = {
  name: "Nomes longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Valida sticky left (Código) e sticky right (ações) ao rolar horizontalmente. Hover nas células de nome e e-mail exibe o texto completo via tooltip nativo.",
      },
    },
  },
  args: {
    initialUsers: [
      { id: "U-001", name: "Administrador Geral do Sistema de Qualidade Agropecuária", email: "administrador.geral.sistema@qualidade-agropecuaria.com.br", type: "Administrador", active: true, photoPath: null, createdAt: Date.now() },
      { id: "U-002", name: "Analista de Qualidade e Testes Automatizados Sênior", email: "analista.qa.senior@empresa-tecnologia.agro.com.br", type: "Padrão", active: true, photoPath: null, createdAt: Date.now() - 1000 },
    ],
    currentUserId: "U-001",
    isAdmin: true,
  },
}
