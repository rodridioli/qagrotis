import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipeChapterRanking } from "@/components/equipe/EquipeChapterRanking"
import type { EquipeChapterRankingRow } from "@/lib/actions/equipe-chapters"

const top3: EquipeChapterRankingRow[] = [
  { position: 1, userId: "U-01", name: "Cibele Esmaniotto", photoPath: null, points: 5 },
  { position: 2, userId: "U-02", name: "Ana Silva", photoPath: null, points: 3 },
  { position: 3, userId: "U-03", name: "Bruno Costa", photoPath: null, points: 2 },
]

const meta: Meta<typeof EquipeChapterRanking> = {
  title: "Equipe/EquipeChapterRanking",
  component: EquipeChapterRanking,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof EquipeChapterRanking>

export const PodioCompleto: Story = {
  args: { entries: top3 },
}

export const SoPrimeiroLugar: Story = {
  args: {
    entries: [{ position: 1, userId: "U-01", name: "Cibele Esmaniotto", photoPath: null, points: 1 }],
  },
}

export const SemDados: Story = {
  args: { entries: [] },
}
