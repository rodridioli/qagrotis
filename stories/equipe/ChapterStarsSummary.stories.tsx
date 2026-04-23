import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ChapterStarsSummary } from "@/components/equipe/ChapterStarsSummary"

const meta: Meta<typeof ChapterStarsSummary> = {
  title: "Equipe/ChapterStarsSummary",
  component: ChapterStarsSummary,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof ChapterStarsSummary>

export const ComMedia: Story = {
  args: {
    avg: 4.3,
    count: 155,
  },
}

export const SemNotas: Story = {
  args: {
    avg: null,
    count: 0,
  },
}

export const UmaNota: Story = {
  args: {
    avg: 5,
    count: 1,
  },
}
