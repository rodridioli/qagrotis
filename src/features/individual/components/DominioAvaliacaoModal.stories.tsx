import type { Meta, StoryObj } from "@storybook/react"
import { DominioAvaliacaoModal } from "./DominioAvaliacaoModal"

const mockProdutos = [
  {
    id: "prod-1",
    nome: "Agrotis Plataforma Agro",
    modulos: [
      { id: "mod-1", nome: "Core / ACC" },
      { id: "mod-2", nome: "REC - Receituário" },
      { id: "mod-3", nome: "CDP - Controle de Pátio" },
    ],
  },
  {
    id: "prod-2",
    nome: "Módulo de Sementes",
    modulos: [
      { id: "mod-4", nome: "SEM - Campos de Sementes" },
      { id: "mod-5", nome: "LAS - Laboratório de Sementes" },
      { id: "mod-6", nome: "BEN - Beneficiamento" },
      { id: "mod-7", nome: "CSEM - Comercial Sementes" },
    ],
  },
  {
    id: "prod-3",
    nome: "Módulo Financeiro",
    modulos: [
      { id: "mod-8", nome: "ARM - Armazenagem" },
      { id: "mod-9", nome: "FIN - Contas a Pagar" },
    ],
  },
]

const meta: Meta<typeof DominioAvaliacaoModal> = {
  title: "Individual/DominioAvaliacaoModal",
  component: DominioAvaliacaoModal,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof DominioAvaliacaoModal>

export const Default: Story = {
  args: {
    avaliacaoId: "avaliacao-mock-123",
    configSnapshot: mockProdutos,
  },
}

export const Empty: Story = {
  args: {
    avaliacaoId: "avaliacao-mock-empty",
    configSnapshot: [],
  },
}

export const SingleProduct: Story = {
  args: {
    avaliacaoId: "avaliacao-mock-single",
    configSnapshot: [mockProdutos[0]!],
  },
}
