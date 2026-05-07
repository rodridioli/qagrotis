import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"

const meta: Meta = {
  title: "UI/Tooltip",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Floating label shown on hover/focus. Background: `bg-brand-primary`. Delay: 400ms. Built on Base UI Tooltip primitive.",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline"><Info className="size-4" /> Passe o mouse</Button>} />
        <TooltipContent>Informação adicional sobre este item</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}

export const OnIcon: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<button className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"><Info className="size-4" /></button>} />
        <TooltipContent>Ação disponível</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}
