import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { OkrKrHistoricoModal } from "./OkrKrHistoricoModal"

/**
 * Modal de histórico de atualizações de valor de um Key Result.
 * Exibe data/hora, valor anterior → novo e nome do usuário que atualizou.
 */
const meta: Meta<typeof OkrKrHistoricoModal> = {
  title: "OKRs/OkrKrHistoricoModal",
  component: OkrKrHistoricoModal,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Exibe o histórico cronológico (mais recente primeiro) de cada atualização do valorAtual de um KR. Cada linha mostra: data/hora, valor anterior → novo (com unidade) e nome do usuário que atualizou.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => {},
    krId: "kr-fake-id",
    krDescricao: "KR01: Entregar 20 cenários de automação com IA para base de regressão do ARM.",
    unidadeLabel: "Unidades",
  },
}

export default meta
type Story = StoryObj<typeof OkrKrHistoricoModal>

/**
 * Lista com múltiplas atualizações — estado normal de uso.
 * (A action getOkrKrHistorico é mockada via parâmetro; em ambiente real usa Server Action.)
 */
export const ComHistorico: Story = {
  name: "Com histórico",
}

/**
 * Quando o KR nunca teve valorAtual atualizado pelo modal.
 */
export const SemHistorico: Story = {
  name: "Sem histórico (empty state)",
}

/**
 * Estado de carregamento enquanto a Server Action responde.
 */
export const Carregando: Story = {
  name: "Carregando",
}
