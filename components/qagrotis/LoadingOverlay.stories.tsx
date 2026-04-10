
import type { Meta, StoryObj } from "@storybook/react"
import { LoadingOverlay } from "./LoadingOverlay"

const meta: Meta<typeof LoadingOverlay> = {
  title: "QAgrotis/LoadingOverlay",
  component: LoadingOverlay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof LoadingOverlay>

export const Default: Story = {
  args: {
    visible: true,
    label: "Processando..."
  }
}

export const CustomLabel: Story = {
  args: {
    visible: true,
    label: "Gerando cenários com IA..."
  }
}
