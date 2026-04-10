
import type { Meta, StoryObj } from "@storybook/react"
import { AssistenteDrawer } from "./AssistenteDrawer"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const meta: Meta<typeof AssistenteDrawer> = {
  title: "QAgrotis/AssistenteDrawer",
  component: AssistenteDrawer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof AssistenteDrawer>

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>Abrir Assistente de IA</Button>
        <AssistenteDrawer 
            open={open} 
            onOpenChange={setOpen} 
            integracoes={[
                { id: "1", provider: "Google", model: "gemini-1.5-pro", descricao: "Gemini Pro (Legacy)", active: true, createdAt: new Date() },
                { id: "2", provider: "OpenAI", model: "gpt-4o", descricao: "GPT-4o Premium", active: true, createdAt: new Date() }
            ]}
        />
      </div>
    )
  }
}

export const SemIntegracoes: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    integracoes: []
  }
}
