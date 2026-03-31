import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  StatusBadge,
  ResultadoBadge,
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
        component: `
Badges de status do QAgrotis. Todos usam o padrão de **pílula com borda** (\`rounded-full px-3 py-1 border\`)
para manter consistência visual com o \`TipoBadge\` de usuários.

### Regras de uso
- **CenarioTipoBadge** → use apenas para o campo \`tipo\` de cenários (Automatizado / Manual / Man./Auto.)
- **SuiteTipoBadge** → use apenas para o campo \`tipo\` de suítes (Sprint / Kanban / Outro)
- **AutomacaoBadge** → use para exibir porcentagem de automação (0–100%)
- **StatusBadge** → use para casos customizados com \`colorClass\` explícito

### Tokens de cor permitidos
Use apenas utilitários Tailwind da paleta do DS: \`green\`, \`red\`, \`amber\`, \`orange\`, \`blue\`, \`brand-primary\`, \`secondary\`.
        `,
      },
    },
  },
}

export default meta
type Story = StoryObj

// ── CenarioTipoBadge ────────────────────────────────────────────────────────

export const CenarioTipos: Story = {
  name: "Cenário — tipos",
  parameters: {
    docs: {
      description: {
        story: `
| Valor | Cor | Design token |
|-------|-----|--------------|
| Automatizado | Verde (brand-primary) | \`border-brand-primary/30 bg-brand-primary/10 text-brand-primary\` |
| Manual | Cinza-azulado (secondary) | \`border-secondary-500/30 bg-secondary-500/10 text-secondary-600\` |
| Man./Auto. | Âmbar | \`border-amber-500/30 bg-amber-500/10 text-amber-600\` |
        `,
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <CenarioTipoBadge tipo="Automatizado" />
      <CenarioTipoBadge tipo="Manual" />
      <CenarioTipoBadge tipo="Man./Auto." />
    </div>
  ),
}

// ── SuiteTipoBadge ──────────────────────────────────────────────────────────

export const SuiteTipos: Story = {
  name: "Suíte — tipos",
  parameters: {
    docs: {
      description: {
        story: `
| Valor | Cor |
|-------|-----|
| Sprint | Verde (\`green-600\`) |
| Kanban | Cinza-azulado (\`secondary-500\`) |
| Outro | Âmbar (\`amber-500\`) |
        `,
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <SuiteTipoBadge tipo="Sprint" />
      <SuiteTipoBadge tipo="Kanban" />
      <SuiteTipoBadge tipo="Outro" />
    </div>
  ),
}

// ── AutomacaoBadge ──────────────────────────────────────────────────────────

export const AutomacaoEscala: Story = {
  name: "Automação — escala de porcentagem",
  parameters: {
    docs: {
      description: {
        story: `
Escala de 4 faixas de cor baseada na porcentagem de automação:

| Faixa | Cor |
|-------|-----|
| 0% | Vermelho (\`red\`) |
| 1–49% | Laranja (\`orange\`) |
| 50–99% | Âmbar (\`amber\`) |
| 100% | Verde (\`green-600\`) |
        `,
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2 p-4">
      <AutomacaoBadge pct={0} />
      <AutomacaoBadge pct={15} />
      <AutomacaoBadge pct={40} />
      <AutomacaoBadge pct={60} />
      <AutomacaoBadge pct={85} />
      <AutomacaoBadge pct={100} />
    </div>
  ),
}

// ── ResultadoBadge ──────────────────────────────────────────────────────────

export const ResultadoTipos: Story = {
  name: "Resultado — histórico de testes",
  parameters: {
    docs: {
      description: {
        story: `
| Valor | Cor |
|-------|-----|
| Sucesso | Verde (\`green-600\`) |
| Erro | Vermelho (\`red-500\`) |
| Pendente | Âmbar (\`amber-500\`) |
        `,
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <ResultadoBadge resultado="Sucesso" />
      <ResultadoBadge resultado="Erro" />
      <ResultadoBadge resultado="Pendente" />
    </div>
  ),
}

// ── StatusBadge customizado ─────────────────────────────────────────────────

export const Custom: Story = {
  name: "StatusBadge customizado",
  parameters: {
    docs: {
      description: {
        story:
          "Use `StatusBadge` com `colorClass` explícito para casos que não se encaixam nos badges tipados. Passe sempre a combinação `border + bg + text` como string de classes Tailwind.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <StatusBadge label="Aprovado"  colorClass="border border-green-600/30 bg-green-100 text-green-700" />
      <StatusBadge label="Reprovado" colorClass="border border-red-500/30 bg-red-100 text-red-700" />
      <StatusBadge label="Pendente"  colorClass="border border-brand-primary/30 bg-brand-primary/10 text-brand-primary" />
      <StatusBadge label="Alerta"    colorClass="border border-amber-500/30 bg-amber-100 text-amber-700" />
      <StatusBadge label="Crítico"   colorClass="border border-red-700/30 bg-red-100 text-red-800" />
    </div>
  ),
}

// ── Paleta de tokens ────────────────────────────────────────────────────────

export const TokensPermitidos: Story = {
  name: "Tokens de cor permitidos",
  parameters: {
    docs: {
      description: {
        story:
          "Paleta de cores disponível no Design System do QAgrotis. Sempre use a combinação `border/30 bg/10 text` para manter consistência visual.",
      },
    },
  },
  render: () => (
    <div className="space-y-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Paleta disponível no DS
      </p>
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="brand-primary" colorClass="border border-brand-primary/30 bg-brand-primary/10 text-brand-primary" />
        <StatusBadge label="green-600"     colorClass="border border-green-600/30 bg-green-600/10 text-green-700" />
        <StatusBadge label="red-500"       colorClass="border border-red-500/30 bg-red-500/10 text-red-700" />
        <StatusBadge label="amber-500"     colorClass="border border-amber-500/30 bg-amber-500/10 text-amber-600" />
        <StatusBadge label="orange-500"    colorClass="border border-orange-500/30 bg-orange-500/10 text-orange-700" />
        <StatusBadge label="blue-500"      colorClass="border border-blue-500/30 bg-blue-500/10 text-blue-700" />
        <StatusBadge label="secondary-500" colorClass="border border-secondary-500/30 bg-secondary-500/10 text-secondary-600" />
      </div>
    </div>
  ),
}

// ── Showcase completo ───────────────────────────────────────────────────────

export const Showcase: Story = {
  name: "Showcase completo",
  parameters: {
    docs: {
      description: {
        story: "Todos os badges lado a lado para verificação visual de consistência.",
      },
    },
  },
  render: () => (
    <div className="space-y-4 p-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Tipo de Cenário</p>
        <div className="flex flex-wrap gap-2">
          <CenarioTipoBadge tipo="Automatizado" />
          <CenarioTipoBadge tipo="Manual" />
          <CenarioTipoBadge tipo="Man./Auto." />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Tipo de Suíte</p>
        <div className="flex flex-wrap gap-2">
          <SuiteTipoBadge tipo="Sprint" />
          <SuiteTipoBadge tipo="Kanban" />
          <SuiteTipoBadge tipo="Outro" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Automação</p>
        <div className="flex flex-wrap items-center gap-2">
          <AutomacaoBadge pct={0} />
          <AutomacaoBadge pct={15} />
          <AutomacaoBadge pct={40} />
          <AutomacaoBadge pct={60} />
          <AutomacaoBadge pct={85} />
          <AutomacaoBadge pct={100} />
        </div>
      </div>
    </div>
  ),
}
