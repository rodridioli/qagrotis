import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { IndividualFeedbacksTable } from "@/components/individual/IndividualFeedbacksTable"
import type { IndividualFeedbackListRow } from "@/lib/actions/individual-feedbacks"

const sampleRows: IndividualFeedbackListRow[] = [
  {
    id: "f1",
    codigo: 3,
    dataYmd: "2026-04-10",
    tipo: "POSITIVO",
    status: "CONCLUIDA",
  },
  {
    id: "f2",
    codigo: 2,
    dataYmd: "2026-03-05",
    tipo: "DESENVOLVIMENTO",
    status: "CONCLUIDA",
  },
  {
    id: "f3",
    codigo: 1,
    dataYmd: "2026-02-20",
    tipo: "FORMAL_CICLO",
    status: "RASCUNHO",
  },
  {
    id: "f4",
    codigo: 4,
    dataYmd: "2026-05-01",
    tipo: "CORRETIVO",
    status: "RASCUNHO",
  },
  {
    id: "f5",
    codigo: 5,
    dataYmd: "2026-05-03",
    tipo: "TREZENTOS_SESSENTA",
    status: "CONCLUIDA",
  },
]

const meta: Meta<typeof IndividualFeedbacksTable> = {
  title: "Individual/FeedbacksTable",
  component: IndividualFeedbacksTable,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof IndividualFeedbacksTable>

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
