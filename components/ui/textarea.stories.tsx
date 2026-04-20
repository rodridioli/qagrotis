import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Textarea } from "@/components/ui/textarea"

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Multi-line text input. Uses `rounded-custom` (`--radius-control`, 0.5em), `border-border-default`, `bg-surface-input`. Supports `error` prop for inline validation message.",
      },
    },
  },
  argTypes: {
    disabled: { control: "boolean" },
    rows: { control: "number" },
    placeholder: { control: "text" },
    error: { control: "text" },
  },
}
export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: "Digite aqui...", rows: 4 },
}

export const WithValue: Story = {
  args: { value: "Conteúdo de exemplo preenchido.", rows: 4, readOnly: true },
}

export const WithError: Story = {
  args: { placeholder: "Campo obrigatório", rows: 3, error: "Este campo é obrigatório." },
}

export const Disabled: Story = {
  args: { placeholder: "Campo desabilitado", rows: 3, disabled: true, value: "Não editável" },
}
