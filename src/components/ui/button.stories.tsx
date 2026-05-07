import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { PlusIcon, ArrowRightIcon, Loader2Icon, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Primary action element. Border radius: `rounded-custom` (`--radius-control`, 0.5em). Horizontal padding end: `pr-[var(--padding-button-inline-end)]` (`--padding-button-inline-end`, 1em ≈ 16px em raiz 16px). Default height: 40px (`h-10`). Variants: `default` (brand-primary), `secondary`, `outline`, `ghost`, `destructive`, `alertOutline` (alerta — fundo amarelo `--alert`, hover suave), `link`. Hovers usam `duration-200 ease-out`. Supports Lucide icons and loading state.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "destructive", "alertOutline", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "xs", "icon", "icon-sm", "icon-lg", "icon-xs"],
    },
    disabled: { control: "boolean" },
  },
}

export default meta
type Story = StoryObj<typeof Button>

// ── Variants ──────────────────────────────────────────────────

export const Primary: Story = {
  name: "Primary (Default)",
  args: {
    children: "Confirmar",
    variant: "default",
  },
}

export const Secondary: Story = {
  args: {
    children: "Cancelar",
    variant: "secondary",
  },
}

export const Outline: Story = {
  args: {
    children: "Ver detalhes",
    variant: "outline",
  },
}

export const AlertOutline: Story = {
  name: "Alerta (amarelo / execução de teste)",
  render: (args) => (
    <Button {...args}>
      <TriangleAlert className="size-4 shrink-0" />
      Alerta
    </Button>
  ),
  args: {
    variant: "alertOutline",
  },
}

// ── States ────────────────────────────────────────────────────

export const Disabled: Story = {
  args: {
    children: "Indisponível",
    variant: "default",
    disabled: true,
  },
}

export const Loading: Story = {
  render: (args) => (
    <Button {...args} disabled>
      <Loader2Icon className="animate-spin" />
      Processando…
    </Button>
  ),
  args: {
    variant: "default",
  },
}

// ── With Icons ────────────────────────────────────────────────

export const WithLeadingIcon: Story = {
  render: (args) => (
    <Button {...args}>
      <PlusIcon />
      Novo teste
    </Button>
  ),
  args: {
    variant: "default",
  },
}

export const WithTrailingIcon: Story = {
  render: (args) => (
    <Button {...args}>
      Próximo
      <ArrowRightIcon />
    </Button>
  ),
  args: {
    variant: "outline",
  },
}

// ── All variants at once ──────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Button variant="default">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="alertOutline">
        <TriangleAlert className="size-4 shrink-0" />
        Alerta
      </Button>
      <Button variant="link">Link</Button>
      <Button variant="default" disabled>Disabled</Button>
    </div>
  ),
}
