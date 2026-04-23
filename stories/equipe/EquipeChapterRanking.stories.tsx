import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { EquipeChapterRanking } from "@/components/equipe/EquipeChapterRanking"
import {
  EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
  type EquipeChapterRankingPage,
  type EquipeChapterRankingRow,
} from "@/lib/equipe-chapters-shared"

function makeRows(startPos: number, count: number, pointsBase: number): EquipeChapterRankingRow[] {
  return Array.from({ length: count }, (_, i) => ({
    position: startPos + i,
    userId: `U-${String(startPos + i).padStart(2, "0")}`,
    name: `Usuário ${startPos + i}`,
    photoPath: null,
    points: Math.max(1, pointsBase - i),
  }))
}

const primeiraPagina: EquipeChapterRankingPage = {
  rows: makeRows(1, 10, 20),
  page: 1,
  pageSize: EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
  totalItems: 24,
  totalPages: 3,
}

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

export const PrimeiraPaginaComPaginacao: Story = {
  render: () => {
    const [data, setData] = React.useState<EquipeChapterRankingPage>(primeiraPagina)
    return (
      <div className="max-w-sm">
        <EquipeChapterRanking
          data={data}
          onPageChange={(p) => {
            const start = (p - 1) * EQUIPE_CHAPTER_RANKING_PAGE_SIZE
            const remaining = Math.max(0, 24 - start)
            const n = Math.min(EQUIPE_CHAPTER_RANKING_PAGE_SIZE, remaining)
            setData({
              ...primeiraPagina,
              page: p,
              rows: makeRows(start + 1, n, 20 - start),
            })
          }}
        />
      </div>
    )
  },
}

export const SoPrimeiroLugar: Story = {
  args: {
    data: {
      rows: [{ position: 1, userId: "U-01", name: "Cibele Esmaniotto", photoPath: null, points: 7 }],
      page: 1,
      pageSize: EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
      totalItems: 1,
      totalPages: 1,
    },
    onPageChange: () => {},
  },
}

export const SemDados: Story = {
  args: {
    data: {
      rows: [],
      page: 1,
      pageSize: EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
      totalItems: 0,
      totalPages: 1,
    },
    onPageChange: () => {},
  },
}
