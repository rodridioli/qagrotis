import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EmptyState } from "@/components/shared/EmptyState"

const meta: Meta<typeof EmptyState> = {
  title: "Shared/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    message: "Nenhum item encontrado.",
  },
}

export const SearchEmpty: Story = {
  args: {
    message: "Nenhum resultado para a busca.",
  },
}

export const InlineSection: Story = {
  args: {
    message: "Nenhuma evidência anexada.",
    className: "mx-0 my-0",
  },
}

export const CustomMargin: Story = {
  args: {
    message: "Nenhum cenário vinculado.",
    className: "mx-5",
  },
}

export const LongMessage: Story = {
  args: {
    message:
      "Nenhuma execução registrada. O histórico será preenchido após a execução dos cenários.",
    className: "mx-5",
  },
}
