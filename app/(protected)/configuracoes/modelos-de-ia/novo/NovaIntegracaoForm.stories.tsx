
import type { Meta, StoryObj } from "@storybook/react"
import NovaIntegracaoForm from "./NovaIntegracaoForm"

const meta: Meta<typeof NovaIntegracaoForm> = {
  title: "Pages/Integracoes/NovaIntegracaoForm",
  component: NovaIntegracaoForm,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof NovaIntegracaoForm>

export const Default: Story = {
  render: () => (
    <div className="p-8 bg-surface-default min-h-screen">
      <NovaIntegracaoForm />
    </div>
  )
}
