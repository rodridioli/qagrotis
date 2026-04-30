import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { IndividualAvaliacoesTable } from "@/components/individual/IndividualAvaliacoesTable"
import type { IndividualPerformanceEvaluationListRow } from "@/lib/actions/individual-performance-evaluations"

const sampleRows: IndividualPerformanceEvaluationListRow[] = [
  {
    id: "a1",
    codigo: 2,
    dataYmd: "2025-12-12",
    pontuacaoPercent: 86,
    status: "CONCLUIDA",
  },
  {
    id: "a2",
    codigo: 1,
    dataYmd: "2025-11-03",
    pontuacaoPercent: 72,
    status: "CONCLUIDA",
  },
  {
    id: "a3",
    codigo: 3,
    dataYmd: "2026-01-20",
    pontuacaoPercent: null,
    status: "RASCUNHO",
  },
]

const meta: Meta<typeof IndividualAvaliacoesTable> = {
  title: "Individual/AvaliacoesTable",
  component: IndividualAvaliacoesTable,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof IndividualAvaliacoesTable>

export const Default: Story = {
  args: {
    rows: sampleRows,
    onEdit: () => {},
    onRequestDelete: () => {},
  },
}

export const Vazio: Story = {
  args: {
    rows: [],
    onEdit: () => {},
    onRequestDelete: () => {},
  },
}
