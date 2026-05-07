import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EmptyState } from "./EmptyState"

const meta: Meta<typeof EmptyState> = {
  title: "QAgrotis/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    message: "Nenhum registro encontrado.",
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
