import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"

const meta: Meta<typeof QAgrotisLogo> = {
  title: "QAgrotis/QAgrotisLogo",
  component: QAgrotisLogo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Logotipo oficial SVG da Agrotis. Cores fixas da marca: marca verde (#00735D) e wordmark escuro (#323E48). Use a prop `height` para escalar proporcionalmente.",
      },
    },
  },
  argTypes: {
    height: { control: { type: "range", min: 16, max: 80, step: 4 } },
  },
}

export default meta
type Story = StoryObj<typeof QAgrotisLogo>

export const Default: Story = {
  args: { height: 36 },
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8 p-4">
      {[20, 28, 36, 48, 64].map((h) => (
        <div key={h} className="flex flex-col items-center gap-2">
          <QAgrotisLogo height={h} />
          <span className="text-xs text-text-secondary">{h}px</span>
        </div>
      ))}
    </div>
  ),
}

export const OnLightBackground: Story = {
  render: () => (
    <div className="rounded-xl bg-surface-default p-8 flex justify-center">
      <QAgrotisLogo height={40} />
    </div>
  ),
}

export const OnWhiteCard: Story = {
  render: () => (
    <div className="rounded-xl bg-surface-card p-8 shadow-card flex justify-center">
      <QAgrotisLogo height={40} />
    </div>
  ),
}
