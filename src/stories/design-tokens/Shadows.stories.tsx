import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { qagrotisTokens } from "@/design-system/tokens"

const SHADOW_TOKENS = [
  {
    name: "shadow-card",
    cssVar: "--shadow-card",
    value: qagrotisTokens.shadows.card,
    description: "Sombra padrão de cards e superfícies elevadas.",
    usage: "Aplicar em cards, dropdowns, painéis e dialogs.",
  },
  {
    name: "shadow-none",
    cssVar: "none",
    value: "none",
    description: "Sem sombra — separar via border.",
    usage: "Elementos planos ou com borda visível.",
  },
]

// Reference shadows for comparison
const REFERENCE_SHADOWS = [
  {
    name: "shadow-xs (referência)",
    value: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  },
  {
    name: "shadow-sm (referência)",
    value: "0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)",
  },
  {
    name: "shadow-md (referência)",
    value: "0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)",
  },
  {
    name: "shadow-lg (referência)",
    value: "0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.10)",
  },
  {
    name: "shadow-xl (referência)",
    value: "0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)",
  },
]

function ShadowCard({
  name,
  cssVar,
  value,
  description,
  usage,
  isToken = true,
}: {
  name: string
  cssVar: string
  value: string
  description?: string
  usage?: string
  isToken?: boolean
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-custom border border-border-default bg-surface-card">
      {/* Preview area */}
      <div className="flex items-center justify-center bg-surface-default px-8 py-10">
        <div
          className="h-24 w-48 rounded-custom bg-surface-card"
          style={{ boxShadow: value === "none" ? "none" : value }}
        />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-sm font-semibold"
            style={{ color: isToken ? "#5c7cfa" : "#9ca3af" }}
          >
            {name}
          </span>
          {isToken && (
            <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs font-medium text-brand-primary">
              token
            </span>
          )}
        </div>
        {cssVar !== "none" && (
          <p className="font-mono text-xs text-neutral-grey-400">{cssVar}</p>
        )}
        <p className="font-mono text-xs text-text-secondary break-all">{value}</p>
        {description && (
          <p className="text-sm text-text-primary">{description}</p>
        )}
        {usage && (
          <p className="text-xs text-text-secondary">{usage}</p>
        )}
      </div>
    </div>
  )
}

function ShadowsPage() {
  return (
    <div className="flex flex-col gap-10 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Shadows</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tokens de sombra do QAgrotis. Utility:{" "}
          <code className="font-mono text-xs">shadow-card</code>. Sombras são
          suaves e difusas para não competir com o conteúdo.
        </p>
      </div>

      {/* Tokens */}
      <div className="flex flex-col gap-3">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Tokens QAgrotis
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {SHADOW_TOKENS.map((s) => (
            <ShadowCard key={s.name} {...s} />
          ))}
        </div>
      </div>

      {/* Escala de referência */}
      <div className="flex flex-col gap-3">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Escala de Referência (Tailwind)
        </h2>
        <p className="text-sm text-text-secondary">
          Apenas para comparação — use sempre o token{" "}
          <code className="font-mono text-xs">shadow-card</code> nos componentes.
        </p>
        <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {REFERENCE_SHADOWS.map((s) => (
            <ShadowCard
              key={s.name}
              name={s.name}
              cssVar="none"
              value={s.value}
              isToken={false}
            />
          ))}
        </div>
      </div>

      {/* Usage examples */}
      <div className="flex flex-col gap-3">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Exemplos de Uso
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Card */}
          <div
            className="flex flex-col gap-3 rounded-custom bg-surface-card p-5"
            style={{ boxShadow: qagrotisTokens.shadows.card }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Card
            </p>
            <p className="text-base font-semibold text-text-primary">
              Suíte #42
            </p>
            <p className="text-sm text-text-secondary">
              24 casos · 98% de aprovação
            </p>
          </div>

          {/* Dropdown */}
          <div
            className="flex flex-col overflow-hidden rounded-custom bg-surface-card"
            style={{ boxShadow: qagrotisTokens.shadows.card }}
          >
            <p className="border-b border-border-default px-4 py-2 text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Dropdown
            </p>
            {["Editar", "Duplicar", "Excluir"].map((item, i) => (
              <button
                key={item}
                className="px-4 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-surface-default"
                style={{ color: i === 2 ? "var(--destructive)" : undefined }}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Input focus */}
          <div
            className="flex flex-col gap-2 rounded-custom bg-surface-card p-4"
            style={{ boxShadow: qagrotisTokens.shadows.card }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Panel
            </p>
            <div className="h-2 w-3/4 rounded-full bg-neutral-grey-200" />
            <div className="h-2 w-1/2 rounded-full bg-neutral-grey-100" />
            <div className="mt-2 h-2 w-2/3 rounded-full bg-primary-100" />
          </div>
        </div>
      </div>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Shadows",
  component: ShadowsPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof ShadowsPage>

export const Shadows: Story = {}
