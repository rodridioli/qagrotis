import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { EquipeChapterRanking } from "@/components/equipe/EquipeChapterRanking"
import {
  EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
  type EquipeChapterRankingPage,
  type EquipeChapterRankingRow,
} from "@/lib/equipe-chapters-shared"

const demoPhoto =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="#64748b" width="64" height="64"/><circle fill="#cbd5e1" cx="32" cy="24" r="10"/><path fill="#cbd5e1" d="M14 56c4-14 36-14 40 0"/></svg>',
  )

function makeRows(startPos: number, count: number, pointsBase: number): EquipeChapterRankingRow[] {
  return Array.from({ length: count }, (_, i) => ({
    position: startPos + i,
    userId: `U-${String(startPos + i).padStart(2, "0")}`,
    name: `Usuário ${startPos + i}`,
    photoPath: null,
    active: true,
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
      rows: [
        { position: 1, userId: "U-01", name: "Cibele Esmaniotto", photoPath: null, active: true, points: 7 },
      ],
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

/** Inativo com foto: avatar em escala de cinza (mesmo critério da aba Chapters em produção). */
export const InativoComFotoEmCinza: Story = {
  args: {
    data: {
      rows: [
        {
          position: 1,
          userId: "U-01",
          name: "Autor ativo",
          photoPath: demoPhoto,
          active: true,
          points: 5,
        },
        {
          position: 2,
          userId: "U-02",
          name: "Autor inativo",
          photoPath: demoPhoto,
          active: false,
          points: 3,
        },
      ],
      page: 1,
      pageSize: EQUIPE_CHAPTER_RANKING_PAGE_SIZE,
      totalItems: 2,
      totalPages: 1,
    },
    onPageChange: () => {},
  },
}
