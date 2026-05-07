import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { EquipeHorariosTable } from "@/features/equipe/components/EquipeHorariosTable"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { EquipeUsuarioCadastro } from "@/features/equipe/actions/equipe"

const mockRows: EquipeUsuarioCadastro[] = [
  {
    userId: "U-01",
    name: "Ana Costa",
    email: "ana@example.com",
    classificacao: "Desenvolvedora",
    photoPath: null,
    dataNascimentoIso: "1992-03-10",
    horarioEntrada: "08:00",
    horarioSaida: "17:00",
    formatoTrabalho: "Híbrido",
    hybridNaoPresencialTooltip: "Não presencial: Seg., Qua., Sex..",
  },
  {
    userId: "U-02",
    name: "Bruno Lima",
    email: "bruno@example.com",
    classificacao: "Tech Lead",
    photoPath: null,
    dataNascimentoIso: null,
    horarioEntrada: "09:30",
    horarioSaida: "18:30",
    formatoTrabalho: "Presencial",
    hybridNaoPresencialTooltip: null,
  },
]

const meta = {
  title: "Equipe/EquipeHorariosTable",
  component: EquipeHorariosTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof EquipeHorariosTable>

export default meta
type Story = StoryObj<typeof meta>

export const ComDados: Story = {
  args: { rows: mockRows },
  render: ({ rows }) => (
    <TooltipProvider>
      <EquipeHorariosTable rows={rows} />
    </TooltipProvider>
  ),
}

export const Vazia: Story = {
  args: { rows: [] },
  render: ({ rows }) => (
    <TooltipProvider>
      <EquipeHorariosTable rows={rows} />
    </TooltipProvider>
  ),
}
