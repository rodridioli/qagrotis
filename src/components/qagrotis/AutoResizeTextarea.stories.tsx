import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AutoResizeTextarea } from "@/components/qagrotis/AutoResizeTextarea"

const meta: Meta<typeof AutoResizeTextarea> = {
  title: "QAgrotis/AutoResizeTextarea",
  component: AutoResizeTextarea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Textarea que se expande automaticamente conforme o conteúdo. Ideal para campos de texto livre em formulários. Herda todos os estilos de `Textarea`.",
      },
    },
  },
  argTypes: {
    placeholder: { control: "text" },
    rows: { control: "number" },
    disabled: { control: "boolean" },
  },
}
export default meta
type Story = StoryObj<typeof AutoResizeTextarea>

export const Default: Story = {
  args: { placeholder: "Digite para expandir automaticamente...", rows: 2 },
}

export const WithContent: Story = {
  args: {
    value: "Este é um exemplo de conteúdo preenchido.\nAo adicionar mais linhas, o campo se expande automaticamente.",
    rows: 2,
    readOnly: true,
  },
}

export const Disabled: Story = {
  args: { placeholder: "Campo desabilitado", disabled: true, rows: 2 },
}
