import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { CommandBarConfirm } from "@/components/qagrotis/CommandBarConfirm"

const meta: Meta<typeof CommandBarConfirm> = {
  title: "QAgrotis/CommandBar/Confirm",
  component: CommandBarConfirm,
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
type Story = StoryObj<typeof CommandBarConfirm>

export const Criar: Story = {
  args: {
    actionType: "create",
    label: 'Criar suite "Financeiro"',
    details: [
      "Nome: Suite Financeiro",
      "Módulo: Financeiro",
      "Status: Ativa",
      "Cenários: nenhum vinculado ainda",
    ],
    onConfirm: fn(),
    onCancel: fn(),
    isConfirming: false,
  },
}

export const Editar: Story = {
  args: {
    actionType: "update",
    label: "Atualizar cenário de login",
    details: [
      "Campo: Resultado esperado",
      "De: Autenticação bem-sucedida",
      "Para: Redirecionar para /dashboard",
    ],
    onConfirm: fn(),
    onCancel: fn(),
    isConfirming: false,
  },
}

export const Excluir: Story = {
  args: {
    actionType: "delete",
    label: "Desativar cenários do cliente Agroforte",
    details: [
      "12 cenários serão desativados",
      "Esta ação pode ser revertida a qualquer momento",
      "Cenários não aparecerão nas listagens ativas",
    ],
    onConfirm: fn(),
    onCancel: fn(),
    isConfirming: false,
  },
}

export const Confirmando: Story = {
  args: {
    ...Criar.args,
    isConfirming: true,
  },
}
