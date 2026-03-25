import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Separator } from "@/components/ui/separator"

const meta: Meta<typeof Separator> = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thin divider line. Supports `horizontal` (default) and `vertical` orientations.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Separator>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64 p-4 space-y-3">
      <p className="text-sm text-text-primary">Seção A</p>
      <Separator />
      <p className="text-sm text-text-primary">Seção B</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-10 items-center gap-3 p-4">
      <span className="text-sm text-text-secondary">Módulo</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-text-secondary">Cliente</span>
      <Separator orientation="vertical" />
      <span className="text-sm text-text-secondary">Tipo</span>
    </div>
  ),
}
