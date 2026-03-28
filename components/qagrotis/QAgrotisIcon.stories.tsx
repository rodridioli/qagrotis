import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QAgrotisIcon } from "@/components/qagrotis/QAgrotisIcon"

const meta: Meta<typeof QAgrotisIcon> = {
  title: "QAgrotis/QAgrotisIcon",
  component: QAgrotisIcon,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Símbolo isolado da marca Agrotis (sem wordmark). Usa `currentColor` — controla a cor via classe Tailwind (ex: `text-brand-primary`). Use em contextos compactos como sidebar recolhida.",
      },
    },
  },
  argTypes: {
    size: { control: { type: "range", min: 12, max: 64, step: 2 } },
  },
}

export default meta
type Story = StoryObj<typeof QAgrotisIcon>

export const Default: Story = {
  args: { size: 20 },
  render: (args) => (
    <div className="text-brand-primary">
      <QAgrotisIcon {...args} />
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8 p-4 text-brand-primary">
      {[12, 16, 20, 28, 40, 56].map((s) => (
        <div key={s} className="flex flex-col items-center gap-2">
          <QAgrotisIcon size={s} />
          <span className="text-xs text-text-secondary">{s}px</span>
        </div>
      ))}
    </div>
  ),
}

export const InSidebarCollapsed: Story = {
  render: () => (
    <div className="flex h-14 w-14 items-center justify-center border-b border-border-default bg-surface-card">
      <QAgrotisIcon size={20} className="text-brand-primary" />
    </div>
  ),
}

export const InActiveNavItem: Story = {
  render: () => (
    <div
      className="flex w-52 items-center gap-3 rounded-lg px-2.5 py-2"
      style={{ backgroundColor: "var(--brand-primary)", color: "#ffffff" }}
    >
      <QAgrotisIcon size={18} />
      <span className="text-sm font-medium">Item ativo</span>
    </div>
  ),
}

export const ColorVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 p-4">
      <div className="flex flex-col items-center gap-1">
        <QAgrotisIcon size={24} className="text-brand-primary" />
        <span className="text-xs text-text-secondary">brand-primary</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <QAgrotisIcon size={24} className="text-text-secondary" />
        <span className="text-xs text-text-secondary">text-secondary</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg bg-brand-primary p-2">
        <QAgrotisIcon size={24} className="text-white" />
        <span className="text-xs" style={{ color: "#ffffff" }}>branco</span>
      </div>
    </div>
  ),
}
