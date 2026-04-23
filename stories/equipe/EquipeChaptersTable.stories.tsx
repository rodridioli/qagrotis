import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipeChaptersTable } from "@/components/equipe/EquipeChaptersTable"
import type { EquipeChapterListRow } from "@/lib/actions/equipe-chapters"

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
