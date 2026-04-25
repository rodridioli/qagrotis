import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { CommandBarResult } from "@/components/qagrotis/CommandBarResult"

const meta: Meta<typeof CommandBarResult> = {
  title: "QAgrotis/CommandBar/Result",
  component: CommandBarResult,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[560px] overflow-hidden rounded-lg border border-border-default bg-surface-card">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof CommandBarResult>

const MOCK_ITEMS = [
  { id: "1", name: "Login com credenciais inválidas", module: "Autenticação", meta: "5 erros" },
  { id: "2", name: "Emissão de NF-e sem estoque disponível", module: "Fiscal", meta: "3 erros" },
  { id: "3", name: "Cálculo de frete internacional", module: "Logística", meta: "2 erros" },
  { id: "4", name: "Aprovação de pedido sem limite de crédito", module: "Vendas", meta: "2 erros" },
  { id: "5", name: "Exportação de relatório em PDF", module: "Relatórios", meta: "1 erro" },
]

export const ComErros: Story = {
  args: {
    title: "7 cenários encontrados com erros recentes",
    items: MOCK_ITEMS,
    viewAllPath: "/cenarios?erros=1",
    onViewAll: fn(),
    onClose: fn(),
  },
}

export const PoucosItens: Story = {
  args: {
    title: "2 suites ativas encontradas",
    items: MOCK_ITEMS.slice(0, 2).map((i) => ({ ...i, meta: undefined })),
    viewAllPath: "/suites",
    onViewAll: fn(),
    onClose: fn(),
  },
}
