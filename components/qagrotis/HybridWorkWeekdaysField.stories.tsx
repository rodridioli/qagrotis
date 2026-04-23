import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { HybridWorkWeekdaysField } from "@/components/qagrotis/HybridWorkWeekdaysField"
import type { DiaSemanaHibridoId } from "@/lib/usuario-trabalho"

const meta: Meta<typeof HybridWorkWeekdaysField> = {
  title: "QAgrotis/HybridWorkWeekdaysField",
  component: HybridWorkWeekdaysField,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Seleção de dias presenciais para modalidade de trabalho Híbrido (cadastro de usuário). Usa tokens do design system.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof HybridWorkWeekdaysField>

function Stateful(args: Partial<React.ComponentProps<typeof HybridWorkWeekdaysField>>) {
  const [value, setValue] = React.useState<DiaSemanaHibridoId[]>(["seg", "qua", "sex"])
  return (
    <div className="max-w-3xl p-4">
      <HybridWorkWeekdaysField
        idPrefix="story"
        value={value}
        onChange={setValue}
        disabled={args.disabled}
      />
      <p className="mt-3 text-xs text-text-secondary">Valor: {JSON.stringify(value)}</p>
    </div>
  )
}

export const Default: Story = {
  render: () => <Stateful />,
}

export const Disabled: Story = {
  render: () => <Stateful disabled />,
}
