import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { CheckCircleIcon, XCircleIcon, ClockIcon, AlertTriangleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Status indicator for test results and pipeline states. Use semantic variants to convey meaning without relying on colour alone.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

// ── Variants ──────────────────────────────────────────────────

export const Default: Story = {
  args: {
    children: "Aprovado",
    variant: "default",
  },
}

export const Secondary: Story = {
  args: {
    children: "Em execução",
    variant: "secondary",
  },
}

export const Destructive: Story = {
  args: {
    children: "Falhou",
    variant: "destructive",
  },
}

export const Outline: Story = {
  args: {
    children: "Pendente",
    variant: "outline",
  },
}

// ── Test Status Palette ───────────────────────────────────────

export const TestStatusPalette: Story = {
  name: "Test Status Palette",
  render: () => (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Badge variant="default">
        <CheckCircleIcon />
        Passed
      </Badge>
      <Badge variant="destructive">
        <XCircleIcon />
        Failed
      </Badge>
      <Badge variant="secondary">
        <ClockIcon />
        Running
      </Badge>
      <Badge variant="outline">
        <ClockIcon />
        Pending
      </Badge>
      <Badge variant="ghost">
        <AlertTriangleIcon />
        Skipped
      </Badge>
    </div>
  ),
}
