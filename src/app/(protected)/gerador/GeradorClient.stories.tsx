
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GeradorClient } from "./GeradorClient"
import { SistemaSelecionadoProvider } from "@/lib/modulo-context"

const meta: Meta<typeof GeradorClient> = {
  title: "Pages/Gerador",
  component: GeradorClient,
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
type Story = StoryObj<typeof GeradorClient>

export const NoIntegrations: Story = {
  args: {
    initialCenarios: [],
    allModulos: [
        { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
    ],
    integracoes: []
  }
}

export const ReadyToGenerate: Story = {
  args: {
    initialCenarios: [],
    allModulos: [
        { id: "M-01", name: "PRO - Produtor Rural", sistemaName: "Plataforma AGRO", active: true, description: null, sistemaId: "S-1" },
    ],
    integracoes: [
        { id: "1", provider: "OpenRouter", model: "google/gemini-2.0-flash-exp:free", descricao: "IA Gratuita", active: true, createdAt: Date.now(), apiKey: "sk-mock" }
    ]
  }
}
