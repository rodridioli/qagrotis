import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { EquipeChaptersTable } from "@/components/equipe/EquipeChaptersTable"
import { TablePagination } from "@/components/qagrotis/TablePagination"
import {
  EQUIPE_CHAPTERS_TABLE_PAGE_SIZE,
  type EquipeChapterListRow,
} from "@/lib/equipe-chapters-shared"

const sampleRows: EquipeChapterListRow[] = [
  {
    id: "1",
    edicao: 3,
    dataYmd: "2026-04-23",
    tema: "Qualidade contínua e métricas de equipe",
    autoresLabel: "Ana Silva, Bruno Costa",
    hyperlink: "https://example.com/slides",
    authorIds: ["u1", "u2"],
    authors: [
      { userId: "u1", name: "Ana Silva", photoPath: null },
      { userId: "u2", name: "Bruno Costa", photoPath: null },
    ],
  },
  {
    id: "2",
    edicao: 2,
    dataYmd: "2026-04-16",
    tema: "Contratos de API",
    autoresLabel: "Carla M.",
    hyperlink: null,
    authorIds: ["u3"],
    authors: [{ userId: "u3", name: "Carla M.", photoPath: null }],
  },
  {
    id: "3",
    edicao: 1,
    dataYmd: "2026-04-09",
    tema: "Onboarding de QA",
    autoresLabel: "Diego",
    hyperlink: "https://notion.so/doc",
    authorIds: ["u4"],
    authors: [{ userId: "u4", name: "Diego", photoPath: null }],
  },
]

const meta: Meta<typeof EquipeChaptersTable> = {
  title: "Equipe/EquipeChaptersTable",
  component: EquipeChaptersTable,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof EquipeChaptersTable>

export const Default: Story = {
  args: {
    rows: sampleRows,
    isAdmin: false,
    onEdit: () => {},
    onRequestDelete: () => {},
  },
}

export const AdminActions: Story = {
  args: {
    rows: sampleRows,
    isAdmin: true,
    onEdit: () => {},
    onRequestDelete: () => {},
  },
}

export const Empty: Story = {
  args: {
    rows: [],
    isAdmin: false,
    onEdit: () => {},
    onRequestDelete: () => {},
  },
}

const manyRows: EquipeChapterListRow[] = Array.from({ length: 24 }, (_, i) => {
  const base = sampleRows[i % sampleRows.length]!
  return {
    ...base,
    id: `row-${i + 1}`,
    edicao: i + 1,
    tema: `${base.tema} (${i + 1})`,
  }
})

export const ComPaginacao: Story = {
  render: () => {
    const [page, setPage] = React.useState(1)
    const totalPages = Math.max(1, Math.ceil(manyRows.length / EQUIPE_CHAPTERS_TABLE_PAGE_SIZE))
    const start = (page - 1) * EQUIPE_CHAPTERS_TABLE_PAGE_SIZE
    const slice = manyRows.slice(start, start + EQUIPE_CHAPTERS_TABLE_PAGE_SIZE)
    return (
      <EquipeChaptersTable
        rows={slice}
        isAdmin
        onEdit={() => {}}
        onRequestDelete={() => {}}
        footer={
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={manyRows.length}
            itemsPerPage={EQUIPE_CHAPTERS_TABLE_PAGE_SIZE}
            onPageChange={setPage}
          />
        }
      />
    )
  },
}
