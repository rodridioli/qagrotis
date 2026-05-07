import type { Meta, StoryObj } from "@storybook/react"
import { CancelActionButton } from "./CancelActionButton"

const meta: Meta<typeof CancelActionButton> = {
  title: "QAgrotis/CancelActionButton",
  component: CancelActionButton,
  parameters: { layout: "centered" },
}

export default meta
type Story = StoryObj<typeof CancelActionButton>

export const Default: Story = {
  args: { onClick: () => {} },
}

export const CustomLabel: Story = {
  args: { children: "Fechar", onClick: () => {} },
}
