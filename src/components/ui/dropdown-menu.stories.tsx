import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreVertical, Pencil, Trash2, Copy } from "lucide-react"

const meta: Meta = {
  title: "UI/DropdownMenu",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Contextual menu opened by a trigger element. Built on Base UI Menu primitive. Supports `variant=\'destructive\'` for danger actions.",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="outline" size="icon"><MoreVertical className="size-4" /></Button>
      } />
      <DropdownMenuContent align="end">
        <DropdownMenuItem><Pencil className="size-4" />Editar</DropdownMenuItem>
        <DropdownMenuItem><Copy className="size-4" />Duplicar</DropdownMenuItem>
        <DropdownMenuItem variant="destructive"><Trash2 className="size-4" />Remover</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const WithText: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Opções</Button>} />
      <DropdownMenuContent align="start">
        <DropdownMenuItem>Exportar para Jira</DropdownMenuItem>
        <DropdownMenuItem>Copiar Markdown</DropdownMenuItem>
        <DropdownMenuItem>Limpar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
