import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const meta: Meta = {
  title: "UI/Sheet",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Painel deslizante (drawer) para conteúdo auxiliar. Usado no menu mobile e na sidebar recolhida. Construído sobre Base UI Dialog.",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Abrir Sheet</Button>} />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu de Navegação</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-text-secondary">Conteúdo do painel lateral aqui.</p>
        </div>
        <SheetClose render={<Button variant="outline" className="mt-4">Fechar</Button>} />
      </SheetContent>
    </Sheet>
  ),
}
