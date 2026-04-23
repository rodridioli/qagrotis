import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { ChapterAuthorsPicklist } from "@/components/equipe/ChapterAuthorsPicklist"
import type { EquipeChapterAuthorOption } from "@/lib/actions/equipe-chapters"

const options: EquipeChapterAuthorOption[] = [
  { id: "u1", name: "Ana Silva" },
  { id: "u2", name: "Bruno Costa" },
  { id: "u3", name: "Carla Mendes" },
  { id: "u4", name: "Diego Souza" },
]

const meta: Meta<typeof ChapterAuthorsPicklist> = {
  title: "Equipe/ChapterAuthorsPicklist",
  component: ChapterAuthorsPicklist,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof ChapterAuthorsPicklist>

function Stateful() {
  const [value, setValue] = React.useState<string[]>(["u1"])
  return (
    <div className="max-w-md p-4">
      <ChapterAuthorsPicklist
        idPrefix="story"
        options={options}
        value={value}
        onChange={setValue}
      />
      <p className="mt-2 text-xs text-text-secondary">Selecionados: {value.join(", ") || "—"}</p>
    </div>
  )
}

export const Default: Story = {
  render: () => <Stateful />,
}
