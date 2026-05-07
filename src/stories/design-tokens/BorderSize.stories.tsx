import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const BORDER_TOKENS = [
  {
    name: "border (1px)",
    cssClass: "border",
    width: 1,
    description: "Borda padrão. Usar com border-border-default na maioria dos componentes.",
    usage: ["Input", "Card", "Select", "Dialog", "Table rows"],
    isDefault: true,
  },
  {
    name: "border-2 (2px)",
    cssClass: "border-2",
    width: 2,
    description: "Borda de destaque. Usar para focus rings, seleção activa ou estados de erro.",
    usage: ["Focus visible", "Selected item", "Error state"],
    isDefault: false,
  },
  {
    name: "border-4 (4px)",
    cssClass: "border-4",
    width: 4,
    description: "Borda forte. Reservar para separadores de secção ou indicadores de progresso.",
    usage: ["Section divider", "Progress indicator"],
    isDefault: false,
  },
  {
    name: "border-0 (0px)",
    cssClass: "border-0",
    width: 0,
    description: "Sem borda. Elementos que usam sombra ou background para separação.",
    usage: ["Ghost button", "Elevated card (shadow only)"],
    isDefault: false,
  },
]

const BORDER_COLORS = [
  {
    name: "border-border-default",
    cssVar: "--border-default",
    hex: "#e5e7eb",
    usage: "Borda neutra padrão — todos os componentes em repouso.",
  },
  {
    name: "border-brand-primary",
    cssVar: "--brand-primary",
    hex: "#5c7cfa",
    usage: "Borda de foco e interacção activa.",
  },
  {
    name: "border-destructive",
    cssVar: "--destructive",
    hex: null,
    usage: "Borda de erro em campos de formulário.",
  },
  {
    name: "border-neutral-grey-200",
    cssVar: "--neutral-grey-200",
    hex: "#e5e7eb",
    usage: "Borda ultra-leve — separadores internos de listas.",
  },
  {
    name: "border-primary-200",
    cssVar: "--qagrotis-primary-200",
    hex: "#c7d5ff",
    usage: "Borda de item seleccionado / highlight.",
  },
]

// ── Width Card ────────────────────────────────────────────────

function WidthCard({
  name,
  width,
  description,
  usage,
  isDefault,
}: {
  name: string
  width: number
  description: string
  usage: string[]
  isDefault: boolean
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
      {/* Preview */}
      <div className="flex items-center justify-center bg-surface-default px-6 py-8">
        <div
          className="h-16 w-40 rounded-custom bg-surface-card"
          style={{
            borderWidth: width,
            borderStyle: width === 0 ? "none" : "solid",
            borderColor: "#5c7cfa",
            boxShadow: width === 0 ? "0 1px 3px 0 rgb(0 0 0 / 0.08)" : undefined,
          }}
        >
          <div className="flex h-full items-center justify-center">
            <span className="font-mono text-xs font-bold text-brand-primary">
              {width}px
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-brand-primary">
            {name}
          </span>
          {isDefault && (
            <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-primary">
              padrão
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary">{description}</p>
        <div className="flex flex-wrap gap-1">
          {usage.map((u) => (
            <span
              key={u}
              className="rounded bg-surface-default px-1.5 py-0.5 font-mono text-xs text-neutral-grey-500"
            >
              {u}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Colour Row ────────────────────────────────────────────────

function ColorRow({
  name,
  cssVar,
  hex,
  usage,
}: {
  name: string
  cssVar: string
  hex: string | null
  usage: string
}) {
  return (
    <div className="flex items-center gap-4 rounded-custom border border-border-default bg-surface-card px-5 py-4 shadow-card">
      {/* Swatch with border */}
      <div
        className="h-12 w-24 shrink-0 rounded-custom bg-surface-default"
        style={{
          borderWidth: 2,
          borderStyle: "solid",
          borderColor: hex ? hex : "var(" + cssVar + ")",
        }}
      />

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-sm font-semibold text-brand-primary">
          {name}
        </span>
        <span className="font-mono text-xs text-neutral-grey-400">{cssVar}</span>
        {hex && (
          <span className="font-mono text-xs text-text-secondary">{hex}</span>
        )}
        <span className="text-xs text-text-secondary">{usage}</span>
      </div>
    </div>
  )
}

// ── States ────────────────────────────────────────────────────

const STATES = [
  {
    label: "Repouso",
    borderColor: "#e5e7eb",
    bgColor: "var(--surface-input)",
    token: "border-border-default / border (1px)",
  },
  {
    label: "Foco",
    borderColor: "#5c7cfa",
    bgColor: "var(--surface-input)",
    token: "border-brand-primary / border-2 (2px)",
    extra: "ring-2 ring-brand-primary/20",
  },
  {
    label: "Erro",
    borderColor: "var(--destructive, #ef4444)",
    bgColor: "var(--surface-input)",
    token: "border-destructive / border-2 (2px)",
    extra: "ring-2 ring-destructive/20",
  },
  {
    label: "Desabilitado",
    borderColor: "#e5e7eb",
    bgColor: "#f9fafb",
    token: "border-border-default / opacity-50",
  },
]

// ── Page ──────────────────────────────────────────────────────

function BorderSizePage() {
  return (
    <div className="flex flex-col gap-12 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Border Size</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Espessuras de borda do QAgrotis. Padrão:{" "}
          <code className="font-mono text-xs font-semibold text-brand-primary">
            border (1px)
          </code>{" "}
          com{" "}
          <code className="font-mono text-xs">border-border-default</code>.
          Foco e selecção usam{" "}
          <code className="font-mono text-xs font-semibold text-brand-primary">
            border-2 (2px)
          </code>
          .
        </p>
      </div>

      {/* Width tokens */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Espessuras
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BORDER_TOKENS.map((t) => (
            <WidthCard key={t.name} {...t} />
          ))}
        </div>
      </div>

      {/* Border colours */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Cores de Borda
        </h2>
        <div className="flex flex-col gap-3">
          {BORDER_COLORS.map((c) => (
            <ColorRow key={c.name} {...c} />
          ))}
        </div>
      </div>

      {/* State examples */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Estados de Input (referência)
        </h2>
        <p className="text-sm text-text-secondary">
          Como as espessuras e cores de borda se combinam nos diferentes estados
          de um campo de formulário.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATES.map(({ label, borderColor, bgColor, token }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-4 shadow-card"
            >
              <p className="text-xs font-semibold text-text-primary">{label}</p>
              <div
                className="flex h-9 w-full items-center rounded-custom px-3 text-sm text-text-secondary transition-all"
                style={{
                  borderWidth: label === "Repouso" || label === "Desabilitado" ? 1 : 2,
                  borderStyle: "solid",
                  borderColor,
                  background: bgColor,
                  opacity: label === "Desabilitado" ? 0.5 : 1,
                  boxShadow:
                    label === "Foco"
                      ? "0 0 0 3px rgba(92, 124, 250, 0.15)"
                      : label === "Erro"
                      ? "0 0 0 3px rgba(239, 68, 68, 0.12)"
                      : undefined,
                }}
              >
                Valor do campo
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-neutral-grey-400">
                {token}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Dividers */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Divisores & Separadores
        </h2>
        <div className="flex flex-col gap-6 rounded-custom border border-border-default bg-surface-card p-6 shadow-card">
          {[
            { label: "border-t (topo)", side: "top" },
            { label: "border-b (base)", side: "bottom" },
            { label: "border-l (esquerda)", side: "left" },
          ].map(({ label, side }) => (
            <div key={label} className="flex items-center gap-4">
              <span className="w-44 shrink-0 font-mono text-xs text-text-secondary">
                {label}
              </span>
              <div
                className="flex-1 rounded-sm bg-surface-default"
                style={{
                  height: side === "left" ? 40 : 24,
                  borderStyle: "solid",
                  borderColor: "#5c7cfa",
                  borderWidth: 0,
                  [`border${side.charAt(0).toUpperCase() + side.slice(1)}Width`]: 1,
                }}
              />
            </div>
          ))}

          <div className="flex items-center gap-4">
            <span className="w-44 shrink-0 font-mono text-xs text-text-secondary">
              divide-y (lista)
            </span>
            <div className="flex-1">
              {["Item A", "Item B", "Item C"].map((item, i) => (
                <div
                  key={item}
                  className="px-3 py-2 text-sm text-text-primary"
                  style={{
                    borderTop: i > 0 ? "1px solid #e5e7eb" : undefined,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Border Size",
  component: BorderSizePage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof BorderSizePage>

export const BorderSize: Story = {}
