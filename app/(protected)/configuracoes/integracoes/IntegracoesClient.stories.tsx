import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import IntegracoesClient from "./IntegracoesClient"
import type { IntegracaoRecord } from "@/lib/actions/integracoes"

const integracoes: IntegracaoRecord[] = [
  { id: "I-01", descricao: "", provider: "openrouter", model: "google/gemini-2.0-flash-exp:free", apiKey: "sk-or-xxxx", active: true, createdAt: Date.now() - 86400000 },
  { id: "I-02", descricao: "", provider: "anthropic", model: "claude-opus-4-6", apiKey: "sk-ant-xxxx", active: true, createdAt: Date.now() - 3600000 },
  { id: "I-03", descricao: "", provider: "openai", model: "gpt-4o-mini", apiKey: "sk-xxxx", active: false, createdAt: Date.now() - 172800000 },
]

const meta: Meta<typeof IntegracoesClient> = {
  title: "Configurações/IntegracoesClient",
  component: IntegracoesClient,
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component: "Tabela de integrações de IA com provedor e modelo. Suporta múltiplos provedores (OpenRouter, Google, Anthropic, OpenAI, Groq). Permite inativação em lote.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof IntegracoesClient>

export const Admin: Story = {
  name: "Visão de administrador",
  args: {
    initialIntegracoes: integracoes,
    isAdmin: true,
  },
}

export const Padrao: Story = {
  name: "Visão de usuário padrão",
  args: {
    initialIntegracoes: integracoes,
    isAdmin: false,
  },
}

export const ListaVazia: Story = {
  name: "Estado vazio",
  args: {
    initialIntegracoes: [],
    isAdmin: true,
  },
}

export const UmProvedor: Story = {
  name: "Integração única ativa",
  args: {
    initialIntegracoes: [
      { id: "I-01", descricao: "", provider: "google", model: "gemini-2.0-flash-exp", apiKey: "AIzaxxxx", active: true, createdAt: Date.now() },
    ],
    isAdmin: true,
  },
}

export const ModelosLongos: Story = {
  name: "Modelos com IDs longos — sticky + truncate + tooltip",
  parameters: {
    docs: {
      description: {
        story: "Valida sticky left (Código) e sticky right (ações) em tabela com poucos campos. Hover no modelo exibe o ID completo via tooltip nativo — importante para IDs de modelos longos como OpenRouter.",
      },
    },
  },
  args: {
    initialIntegracoes: [
      { id: "I-001", descricao: "", provider: "openrouter", model: "google/gemini-2.5-pro-exp-03-25:free", apiKey: "sk-or-xxxx", active: true, createdAt: Date.now() },
      { id: "I-002", descricao: "", provider: "anthropic", model: "claude-sonnet-4-6-20251101", apiKey: "sk-ant-xxxx", active: true, createdAt: Date.now() - 1000 },
      { id: "I-003", descricao: "", provider: "openrouter", model: "meta-llama/llama-4-maverick:free", apiKey: "sk-or-yyyy", active: true, createdAt: Date.now() - 2000 },
    ],
    isAdmin: true,
  },
}
