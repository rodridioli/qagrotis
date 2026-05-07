import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Input } from "@/components/ui/input"

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Text input built on `surface-input` token. Accepts an `error` prop for Zod validation messages. All visual values come from design tokens.",
      },
    },
  },
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
    error: { control: "text" },
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

// ── States ────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    placeholder: "Nome do teste…",
    type: "text",
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: "Teste regressão #42",
    type: "text",
  },
}

export const Disabled: Story = {
  args: {
    placeholder: "Campo desabilitado",
    disabled: true,
    type: "text",
  },
}

export const WithError: Story = {
  name: "Error (Zod)",
  args: {
    placeholder: "E-mail",
    type: "email",
    defaultValue: "not-an-email",
    error: "Digite um endereço de e-mail válido.",
  },
}

export const Password: Story = {
  args: {
    placeholder: "Senha",
    type: "password",
  },
}

// ── Form Example ─────────────────────────────────────────────

export const FormExample: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4 rounded-custom border border-border-default bg-surface-card p-6 shadow-card">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary">Nome</label>
        <Input placeholder="Ex: João Silva" type="text" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary">E-mail</label>
        <Input placeholder="joao@empresa.com" type="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-primary">E-mail inválido</label>
        <Input
          placeholder="joao@empresa.com"
          type="email"
          defaultValue="invalido"
          error="Digite um e-mail válido."
        />
      </div>
    </div>
  ),
}
