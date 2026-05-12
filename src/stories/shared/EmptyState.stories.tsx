import type { Meta, StoryObj } from "@storybook/react"
import { Building2, ClipboardList, Layers, Server, Users } from "lucide-react"
import { EmptyState } from "@/components/shared/EmptyState"

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    message: "Nenhum item encontrado.",
  },
}

export const WithIcon: Story = {
  args: {
    icon: Users,
    message: "Nenhum usuário cadastrado ainda.",
  },
}

export const WithDescription: Story = {
  args: {
    icon: Building2,
    message: "Nenhum cliente cadastrado ainda.",
    description: "Clientes são associados a cenários e suítes de teste.",
  },
}

export const WithAction: Story = {
  args: {
    icon: ClipboardList,
    message: "Nenhum cenário cadastrado ainda.",
    description: "Crie seu primeiro cenário para começar a organizar os testes.",
    action: { label: "Criar Cenário", onClick: () => {} },
  },
}

export const Sistemas: Story = {
  args: {
    icon: Server,
    message: "Nenhum sistema cadastrado ainda.",
    description: "Sistemas agrupam módulos e cenários de teste.",
  },
}

export const Modulos: Story = {
  args: {
    icon: Layers,
    message: "Nenhum módulo cadastrado ainda.",
    description: "Módulos são subdivisões de um sistema.",
  },
}
