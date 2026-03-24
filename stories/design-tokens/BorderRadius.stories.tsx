import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const RADIUS_TOKENS = [
  {
    name: "rounded-custom",
    cssVar: "--radius-custom",
    value: "4px",
    description: "Token padrão QAgrotis. Aplicar em todos os atoms: Button, Input, Card, Badge, Dialog.",
    isDefault: true,
  },
  {
    name: "rounded-none",
    cssVar: "—",
    value: "0px",
    description: "Bordas retas. Usar apenas em contextos de tabela ou elementos de largura total.",
    isDefault: false,
  },
  {
    name: "rounded-md",
    cssVar: "--radius-md",
    value: "8px",
    description: "Raio médio do sistema base (Shadcn/base-ui). Usar com critério.",
    isDefault: false,
  },
  {
    name: "rounded-lg",
    cssVar: "--radius-lg",
    value: "10px",
    description: "Raio grande. Reservado para modais e sheets.",
    isDefault: false,
  },
  {
    name: "rounded-xl",
    cssVar: "--radius-xl",
    value: "14px",
    description: "Raio extra. Evitar — fora do padrão QAgrotis.",
    isDefault: false,
  },
  {
    name: "rounded-full",
    cssVar: "—",
    value: "9999px",
    description: "Totalmente arredondado. Usar em avatars, badges de status e toggles.",
    isDefault: false,
  },
]

function RadiusCard({
  name,
  cssVar,
  value,
  description,
  isDefault,
}: {
  name: string
  cssVar: string
  value: string
  description: string
  isDefault: boolean
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
      {/* Visual preview */}
      <div className="flex items-center justify-center bg-surface-default px-6 py-8">
        <div
          className="h-20 w-32 bg-primary-100 ring-2 ring-primary-300"
          style={{ borderRadius: value }}
        >
          <div
            className="flex h-full w-full items-center justify-center bg-brand-primary/10"
            style={{ borderRadius: value }}
          >
            <span className="font-mono text-sm font-bold text-brand-primary">
              {value}
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-brand-primary">
            {name}
          </span>
          {isDefault && (
            <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-primary">
              padrão QAgrotis
            </span>
          )}
        </div>
        {cssVar !== "—" && (
          <p className="font-mono text-xs text-neutral-grey-400">{cssVar}</p>
        )}
        <p className="text-xs text-text-secondary">{description}</p>
      </div>
    </div>
  )
}

function BorderRadiusPage() {
  return (
    <div className="flex flex-col gap-10 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Border Radius</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Token padrão:{" "}
          <code className="font-mono text-xs font-semibold text-brand-primary">
            rounded-custom (4px)
          </code>
          . Aplicar em todos os componentes atoms. Valores maiores apenas em
          contextos específicos como modais.
        </p>
      </div>

      {/* Token grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {RADIUS_TOKENS.map((r) => (
          <RadiusCard key={r.name} {...r} />
        ))}
      </div>

      {/* Usage examples */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Componentes com rounded-custom (4px)
        </h2>
        <div className="flex flex-wrap items-center gap-6 rounded-custom border border-border-default bg-surface-card p-6 shadow-card">
          {/* Button */}
          <div className="flex flex-col items-center gap-2">
            <button
              className="bg-brand-primary px-4 py-2 text-sm font-medium text-white"
              style={{ borderRadius: "4px" }}
            >
              Button
            </button>
            <span className="font-mono text-xs text-neutral-grey-400">Button</span>
          </div>

          {/* Input */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-9 w-36 items-center border border-border-default bg-surface-input px-3 text-sm text-text-secondary"
              style={{ borderRadius: "4px" }}
            >
              Input field
            </div>
            <span className="font-mono text-xs text-neutral-grey-400">Input</span>
          </div>

          {/* Badge */}
          <div className="flex flex-col items-center gap-2">
            <span
              className="bg-primary-100 px-2 py-0.5 text-xs font-medium text-brand-primary"
              style={{ borderRadius: "4px" }}
            >
              Badge
            </span>
            <span className="font-mono text-xs text-neutral-grey-400">Badge</span>
          </div>

          {/* Card */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-16 w-24 items-center justify-center border border-border-default bg-surface-card text-xs text-text-secondary shadow-card"
              style={{ borderRadius: "4px" }}
            >
              Card
            </div>
            <span className="font-mono text-xs text-neutral-grey-400">Card</span>
          </div>

          {/* Chip arredondado (badge full) */}
          <div className="flex flex-col items-center gap-2">
            <span
              className="bg-primary-100 px-3 py-0.5 text-xs font-medium text-brand-primary"
              style={{ borderRadius: "9999px" }}
            >
              Status
            </span>
            <span className="font-mono text-xs text-neutral-grey-400">Pill Badge</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Border Radius",
  component: BorderRadiusPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof BorderRadiusPage>

export const BorderRadius: Story = {}
