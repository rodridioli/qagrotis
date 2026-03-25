import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Checkbox } from "@/components/ui/checkbox"

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Checkbox input using design tokens. Supports optional label and all native input props.",
      },
    },
  },
  argTypes: {
    label: { control: "text" },
    disabled: { control: "boolean" },
    checked: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: {
    label: "Aceitar termos",
  },
}

export const Checked: Story = {
  args: {
    label: "Ativo",
    defaultChecked: true,
  },
}

export const WithoutLabel: Story = {
  args: {},
}

export const Disabled: Story = {
  args: {
    label: "Desabilitado",
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    label: "Desabilitado e marcado",
    disabled: true,
    defaultChecked: true,
  },
}

export const InFilterContext: Story = {
  name: "Em contexto de filtro",
  render: () => (
    <div className="space-y-2 p-4">
      <Checkbox label="Exibir somente inativos" />
      <Checkbox label="Somente automatizados" />
      <Checkbox label="Com erros" defaultChecked />
    </div>
  ),
}
