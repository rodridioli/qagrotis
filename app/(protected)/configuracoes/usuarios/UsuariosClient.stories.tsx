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
        component:
          "Tabela de usuários com busca e filtros. Por padrão lista só cadastros ativos; use Filtros → «Exibir somente inativos» para ver inativados.",
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

export const InativoOcultoAteFiltrar: Story = {
  name: "Inativo (U-03) oculto até filtrar",
  parameters: {
    docs: {
      description: {
        story: "Na lista padrão aparecem só U-01 e U-02. Abra Filtros, marque «Exibir somente inativos» e aplique para ver U-03.",
      },
    },
  },
  args: {
    initialUsers: base,
    currentUserId: "U-01",
    isAdmin: true,
  },
}

export const NomesLongos: Story = {
  name: "Nomes longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Em viewports estreitos pode haver rolagem horizontal; em telas maiores a tabela usa 100% da largura com truncate. Hover em nome e e-mail mostra o texto completo (title).",
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
