import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { RankingPositionBadge } from "@/components/qagrotis/RankingPositionBadge"

const meta: Meta<typeof RankingPositionBadge> = {
  title: "QAgrotis/RankingPositionBadge",
  component: RankingPositionBadge,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof RankingPositionBadge>

export const Podio: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-card p-4">
      {[1, 2, 3, 4].map((position) => (
        <RankingPositionBadge key={position} position={position} />
      ))}
    </div>
  ),
}
