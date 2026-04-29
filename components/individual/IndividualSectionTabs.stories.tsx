import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { IndividualSectionTabsPresentation } from "./IndividualSectionTabs"

const meta: Meta<typeof IndividualSectionTabsPresentation> = {
  title: "Individual/SectionTabs",
  component: IndividualSectionTabsPresentation,
  tags: ["autodocs"],
  argTypes: {
    pathname: { control: "text" },
    querySuffix: { control: "text" },
  },
}

export default meta
type Story = StoryObj<typeof IndividualSectionTabsPresentation>

export const DominioAtivo: Story = {
  args: {
    pathname: "/individual/dominio",
    querySuffix: "?userId=U-23",
  },
}

export const PdiAtivoSemQuery: Story = {
  args: {
    pathname: "/individual/pdi",
    querySuffix: "",
  },
}

export const RaizIndividual: Story = {
  args: {
    pathname: "/individual",
    querySuffix: "",
  },
}
