import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { ChapterRatingDialog } from "@/components/equipe/ChapterRatingDialog"
import type { EquipeChapterRatingEntry } from "@/lib/equipe-chapters-shared"

const previewEntries: EquipeChapterRatingEntry[] = [
  { id: "r1", stars: 5, comment: "Muito claro e aplicável ao dia a dia.", createdAt: "2026-04-22T14:30:00.000Z" },
  { id: "r2", stars: 4, comment: "", createdAt: "2026-04-21T09:00:00.000Z" },
  { id: "r3", stars: 0, comment: "Sem comentário.", createdAt: "2026-04-20T18:15:00.000Z" },
]

const meta: Meta<typeof ChapterRatingDialog> = {
  title: "Equipe/ChapterRatingDialog",
  component: ChapterRatingDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal de avaliações: distribuição, resumo, formulário 0–5 estrelas + comentário e histórico anónimo. Com `previewEntries`, não há chamadas ao servidor e o envio fica desativado.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ChapterRatingDialog>

export const ComHistoricoPreview: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true)
    return (
      <div className="p-4">
        <button
          type="button"
          className="rounded-md border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary"
          onClick={() => setOpen(true)}
        >
          Abrir modal
        </button>
        <ChapterRatingDialog
          open={open}
          onOpenChange={setOpen}
          chapterId="story-chapter"
          tema="Qualidade contínua e métricas de equipe"
          previewEntries={previewEntries}
        />
      </div>
    )
  },
}
