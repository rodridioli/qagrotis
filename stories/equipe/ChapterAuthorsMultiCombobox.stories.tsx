import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { ChapterAuthorsMultiCombobox } from "@/components/equipe/ChapterAuthorsMultiCombobox"
import type { EquipeChapterAuthorOption } from "@/lib/equipe-chapters-shared"

const options: EquipeChapterAuthorOption[] = [
  { id: "u1", name: "Ana Silva" },
  { id: "u2", name: "Bruno Costa" },
  { id: "u3", name: "Carla Mendes" },
  { id: "u4", name: "Diego Souza" },
]

const meta: Meta<typeof ChapterAuthorsMultiCombobox> = {
  title: "Equipe/ChapterAuthorsMultiCombobox",
  component: ChapterAuthorsMultiCombobox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Multi-select de autores com gatilho estilo select, busca e checkboxes nas opções (modal Chapter).",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ChapterAuthorsMultiCombobox>

function Stateful() {
  const [value, setValue] = React.useState<string[]>(["u1"])
  return (
    <div className="max-w-md p-4">
      <ChapterAuthorsMultiCombobox
        idPrefix="story"
        options={options}
        value={value}
        onChange={setValue}
      />
      <p className="mt-2 text-xs text-text-secondary">IDs: {value.join(", ") || "—"}</p>
    </div>
  )
}

export const Default: Story = {
  render: () => <Stateful />,
}
