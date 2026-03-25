import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  StatusBadge,
  CenarioTipoBadge,
  SuiteTipoBadge,
  AutomacaoBadge,
} from "@/components/qagrotis/StatusBadge"

const meta: Meta = {
  title: "QAgrotis/StatusBadge",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Badges de status do QAgrotis. Tokens permitidos: `bg-green-*`, `bg-red-*`, `bg-yellow-*`, `bg-orange-*`, `bg-primary-*`. `amber` não existe no DS — substitua por `yellow` ou `orange`.",
      },
    },
  },
}

export default meta
type Story = StoryObj

export const CenarioTipos: Story = {
  name: "Cenário — tipos",
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <CenarioTipoBadge tipo="Automatizado" />
      <CenarioTipoBadge tipo="Manual" />
      <CenarioTipoBadge tipo="Man./Auto." />
    </div>
  ),
}

export const SuiteTipos: Story = {
  name: "Suíte — tipos",
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <SuiteTipoBadge tipo="Sprint" />
      <SuiteTipoBadge tipo="Kanban" />
      <SuiteTipoBadge tipo="Outro" />
    </div>
  ),
}

export const AutomacaoEscala: Story = {
  name: "Automação — escala de porcentagem",
  render: () => (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <AutomacaoBadge pct={0} />
      <AutomacaoBadge pct={25} />
      <AutomacaoBadge pct={60} />
      <AutomacaoBadge pct={85} />
      <AutomacaoBadge pct={100} />
    </div>
  ),
}

export const Custom: Story = {
  name: "StatusBadge customizado",
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <StatusBadge label="Aprovado"  colorClass="bg-green-100 text-green-700" />
      <StatusBadge label="Reprovado" colorClass="bg-red-100 text-red-700" />
      <StatusBadge label="Pendente"  colorClass="bg-primary-100 text-primary-700" />
      <StatusBadge label="Alerta"    colorClass="bg-yellow-100 text-yellow-700" />
      <StatusBadge label="Crítico"   colorClass="bg-red-100 text-red-800" />
    </div>
  ),
}

export const TokensPermitidos: Story = {
  name: "Tokens de cor permitidos",
  render: () => (
    <div className="space-y-3 p-4">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Paleta disponível no DS</p>
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="green-100/700" colorClass="bg-green-100 text-green-700" />
        <StatusBadge label="red-100/700"   colorClass="bg-red-100 text-red-700" />
        <StatusBadge label="yellow-100/700" colorClass="bg-yellow-100 text-yellow-700" />
        <StatusBadge label="blue-100/700"  colorClass="bg-blue-100 text-blue-700" />
        <StatusBadge label="purple-100/700" colorClass="bg-purple-100 text-purple-700" />
        <StatusBadge label="primary-100/700" colorClass="bg-primary-100 text-primary-700" />
      </div>
    </div>
  ),
}
