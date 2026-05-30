import type { Meta, StoryObj } from "@storybook/react"
import { IntegrationNotConfiguredCard } from "./IntegrationNotConfiguredCard"

const meta: Meta<typeof IntegrationNotConfiguredCard> = {
  title: "Shared/IntegrationNotConfiguredCard",
  component: IntegrationNotConfiguredCard,
  parameters: { layout: "centered" },
}

export default meta
type Story = StoryObj<typeof IntegrationNotConfiguredCard>

export const Jira: Story = {
  args: { type: "jira" },
}

export const Clockwork: Story = {
  args: { type: "clockwork" },
}
