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

export const FichaAtiva: Story = {
  args: {
    pathname: "/individual/ficha",
    querySuffix: "?userId=U-23",
  },
}

export const DominioAtivo: Story = {
  args: {
    pathname: "/individual/dominio",
    querySuffix: "?userId=U-23",
  },
}

export const FeriasAtivas: Story = {
  args: {
    pathname: "/individual/ferias",
    querySuffix: "",
  },
}

export const PdiAtivoSemQuery: Story = {
  args: {
    pathname: "/individual/pdi",
    querySuffix: "",
  },
}

export const ProgressaoAtiva: Story = {
  args: {
    pathname: "/individual/progressao",
    querySuffix: "",
  },
}

export const RaizIndividual: Story = {
  args: {
    pathname: "/individual",
    querySuffix: "",
  },
}

/** Rota de edição de avaliação mantém o destaque na aba Avaliações. */
export const AvaliacoesAtivaNaSubrota: Story = {
  args: {
    pathname: "/individual/avaliacao/clxyz123",
    querySuffix: "?userId=U-23",
  },
}
