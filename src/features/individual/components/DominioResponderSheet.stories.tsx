import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DominioResponderSheet } from "./DominioResponderSheet"

const mockOnSubmit = () => Promise.resolve({})
const mockOnSubmitError = () => Promise.resolve({ error: "Erro simulado ao enviar avaliação." })

const mockProdutos = [
  {
    id: "prod-1",
    nome: "Agrotis Plataforma Agro",
    modulos: [
      { id: "mod-1", nome: "Core / ACC" },
      { id: "mod-2", nome: "REC - Receituário" },
      { id: "mod-3", nome: "CDP - Controle de Pátio e Operações Logísticas" },
    ],
  },
  {
    id: "prod-2",
    nome: "Módulo de Sementes",
    modulos: [
      { id: "mod-4", nome: "SEM - Campos de Sementes" },
      { id: "mod-5", nome: "LAS - Laboratório de Sementes" },
    ],
  },
  {
    id: "prod-3",
    nome: "Agrotis Gerencial",
    modulos: [
      { id: "mod-6", nome: "Sped" },
    ],
  },
]

const meta: Meta<typeof DominioResponderSheet> = {
  title: "Individual/DominioResponderSheet",
  component: DominioResponderSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "Drawer lateral para o usuário responder uma avaliação de domínio pendente. " +
          "Exibe Média Geral em tempo real, cards de produto expansíveis com estrelas interativas e botão Enviar habilitado apenas quando todos os módulos estão avaliados.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    avaliacaoId: "mock-avaliacao-123",
    onSubmit: mockOnSubmit,
  },
}

export default meta
type Story = StoryObj<typeof DominioResponderSheet>

export const Default: Story = {
  name: "3 produtos · múltiplos módulos",
  args: {
    configSnapshot: mockProdutos,
  },
}

export const UmProdutoUmModulo: Story = {
  name: "1 produto · 1 módulo",
  args: {
    configSnapshot: [
      {
        id: "p1",
        nome: "Front-end",
        modulos: [{ id: "m1", nome: "React" }],
      },
    ],
  },
}

export const NomesTrunucados: Story = {
  name: "Nomes longos (tooltip visível no hover)",
  args: {
    configSnapshot: [
      {
        id: "p1",
        nome: "Agrotis Plataforma Agro — Gestão Integrada de Operações Rurais",
        modulos: [
          { id: "m1", nome: "CDP - Controle de Pátio e Operações Logísticas Integradas" },
          { id: "m2", nome: "REC - Receituário Agronômico e Prescrições Técnicas" },
        ],
      },
    ],
  },
}

export const ErroEnvio: Story = {
  name: "Erro ao enviar (mock)",
  args: {
    configSnapshot: mockProdutos,
    onSubmit: mockOnSubmitError,
  },
}

export const SemProdutos: Story = {
  name: "Sem produtos configurados",
  args: {
    configSnapshot: [],
  },
}
