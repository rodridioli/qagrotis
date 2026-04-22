import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipeAniversarioCard } from "@/components/equipe/EquipeAniversarioCard"

const meta = {
  title: "Equipe/EquipeAniversarioCard",
  component: EquipeAniversarioCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof EquipeAniversarioCard>

export default meta
type Story = StoryObj<typeof meta>

export const Padrao: Story = {
  args: {
    name: "Maria Silva",
    classificacao: "Analista de QA",
    photoPath: null,
    dataNascimentoLabel: "15/08/1990",
  },
  decorators: [
    (StoryEl) => (
      <div className="w-full max-w-sm bg-surface-default p-4">
        <StoryEl />
      </div>
    ),
  ],
}
