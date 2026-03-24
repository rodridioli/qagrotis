import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { qagrotisTokens } from "@/design-system/tokens"

// ── Utilities ─────────────────────────────────────────────────

/** Convert #rrggbb → { r, g, b } */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null
}

/** Determine if text on this background should be dark or light */
function contrastColor(hex: string): "#ffffff" | "#333333" {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#333333"
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return lum > 0.55 ? "#333333" : "#ffffff"
}

/** #rrggbb → "R G B" */
function rgbString(hex: string): string {
  const rgb = hexToRgb(hex)
  return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : ""
}

// ── Section ───────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="border-b border-border-default pb-3">
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Semantic card ─────────────────────────────────────────────

const SEMANTIC_META: Record<string, { label: string; usage: string }> = {
  brandPrimary:    { label: "brand-primary",    usage: "CTAs, links, foco" },
  surfaceDefault:  { label: "surface-default",  usage: "Background de página" },
  surfaceCard:     { label: "surface-card",     usage: "Cards e painéis" },
  surfaceInput:    { label: "surface-input",    usage: "Campos de formulário" },
  textPrimary:     { label: "text-primary",     usage: "Títulos e corpo" },
  textSecondary:   { label: "text-secondary",   usage: "Labels e metadados" },
  borderDefault:   { label: "border-default",   usage: "Bordas e divisores" },
}

function SemanticCard({
  tokenKey,
  hex,
  cssVar,
}: {
  tokenKey: string
  hex: string
  cssVar: string
}) {
  const meta = SEMANTIC_META[tokenKey]
  const fg   = contrastColor(hex)
  const rgb  = hexToRgb(hex)

  return (
    <div className="overflow-hidden rounded-custom border border-border-default shadow-card">
      {/* Swatch */}
      <div
        className="relative flex h-28 flex-col justify-between p-3"
        style={{ background: `var(${cssVar}, ${hex})` }}
      >
        <span
          className="font-mono text-xs font-semibold tracking-wide opacity-80"
          style={{ color: fg }}
        >
          {meta?.label ?? tokenKey}
        </span>
        <span
          className="font-mono text-lg font-bold"
          style={{ color: fg }}
        >
          {hex}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 bg-surface-card px-3 py-2.5">
        {rgb && (
          <p className="font-mono text-xs text-neutral-grey-400">
            rgb({rgb.r}, {rgb.g}, {rgb.b})
          </p>
        )}
        <p className="font-mono text-xs text-text-secondary">{cssVar}</p>
        {meta?.usage && (
          <p className="text-xs text-text-secondary">{meta.usage}</p>
        )}
      </div>
    </div>
  )
}

// ── Scale chip ────────────────────────────────────────────────

function ScaleChip({
  shade,
  hex,
  cssVar,
  isBase,
}: {
  shade: string
  hex: string
  cssVar: string
  isBase?: boolean
}) {
  const fg = contrastColor(hex)

  return (
    <div className="group flex flex-col gap-1.5">
      <div
        className="relative flex h-20 flex-col items-center justify-center rounded-custom transition-transform group-hover:scale-105"
        style={{
          background: `var(${cssVar}, ${hex})`,
          outline: isBase ? "3px solid #5c7cfa" : undefined,
          outlineOffset: isBase ? "3px" : undefined,
        }}
      >
        <span className="font-mono text-sm font-bold" style={{ color: fg }}>
          {shade}
        </span>
        {isBase && (
          <span
            className="mt-0.5 rounded px-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: fg === "#ffffff" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)",
              color: fg,
            }}
          >
            base
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="font-mono text-[11px] font-medium text-text-primary">{hex}</p>
        <p className="font-mono text-[10px] text-neutral-grey-400 truncate" title={cssVar}>
          {cssVar}
        </p>
      </div>
    </div>
  )
}

// ── Opacity palette ───────────────────────────────────────────

const OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

function OpacityRow({
  label,
  hex,
  cssVar,
}: {
  label: string
  hex: string
  cssVar: string
}) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-text-primary">{label}</p>
      <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
        {OPACITIES.map((op) => (
          <div key={op} className="flex flex-col gap-1.5">
            {/* Checkerboard to show transparency */}
            <div
              className="h-14 rounded-custom border border-border-default"
              style={{
                background: `linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%) 0 0 / 10px 10px,
                             linear-gradient(45deg, #ccc 25%, #fff 25%, #fff 75%, #ccc 75%) 5px 5px / 10px 10px`,
                position: "relative",
              }}
            >
              <div
                className="absolute inset-0 rounded-custom"
                style={{
                  background: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${op}%)`,
                }}
              />
            </div>
            <p className="font-mono text-[10px] text-text-secondary text-center">
              /{op}
            </p>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs text-neutral-grey-400">
        Uso: <code>bg-{cssVar.replace("--", "")}/{"{opacity}"}</code> ou{" "}
        <code>text-{cssVar.replace("--", "")}/{"{opacity}"}</code>
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

function ColorsPage() {
  const { colors } = qagrotisTokens

  return (
    <div className="flex flex-col gap-14 bg-surface-default p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Colors</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Todos os valores definidos em{" "}
          <code className="rounded bg-surface-card px-1 py-0.5 font-mono text-xs text-text-primary">
            design-system/tokens.ts
          </code>
          . Use apenas utilities Tailwind — nunca hex directo.
        </p>
      </div>

      {/* Semantic */}
      <Section
        title="Tokens Semânticos"
        description="Cores com intenção de uso. Substitui sempre o hex pelo token correspondente."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(colors.semantic).map(([key, hex]) => {
            const cssKey = key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
            const resolvedHex = hex.startsWith("var") ? colors.primitives.blue : hex
            return (
              <SemanticCard
                key={key}
                tokenKey={key}
                hex={resolvedHex}
                cssVar={`--${cssKey}`}
              />
            )
          })}
        </div>
      </Section>

      {/* Primary scale */}
      <Section
        title="Primary Scale"
        description="10 tons em torno de #5c7cfa (hue 228°). Utilities: bg-primary-50 → bg-primary-900."
      >
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {Object.entries(colors.primary).map(([shade, hex]) => (
            <ScaleChip
              key={shade}
              shade={shade}
              hex={hex}
              cssVar={`--qagrotis-primary-${shade}`}
              isBase={shade === "500"}
            />
          ))}
        </div>
      </Section>

      {/* Secondary scale */}
      <Section
        title="Secondary Scale"
        description="Cool slate — 10 tons. Utilities: bg-secondary-50 → bg-secondary-900."
      >
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {Object.entries(colors.secondary).map(([shade, hex]) => (
            <ScaleChip
              key={shade}
              shade={shade}
              hex={hex}
              cssVar={`--qagrotis-secondary-${shade}`}
              isBase={shade === "500"}
            />
          ))}
        </div>
      </Section>

      {/* Neutral grey */}
      <Section
        title="Neutral Grey Scale"
        description="Cinza frio para fundos, bordas e texto. Utilities: bg-neutral-grey-50 → bg-neutral-grey-900."
      >
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
          {Object.entries(colors.neutralGrey).map(([shade, hex]) => (
            <ScaleChip
              key={shade}
              shade={shade}
              hex={hex}
              cssVar={`--neutral-grey-${shade}`}
              isBase={shade === "500"}
            />
          ))}
        </div>
      </Section>

      {/* Opacity */}
      <Section
        title="Cores com Opacidade"
        description="Todas as utilities de cor aceitam modificador de opacidade nativo do Tailwind v4. Ex: bg-brand-primary/20, text-primary-500/50."
      >
        <div className="flex flex-col gap-6 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
          <OpacityRow
            label="brand-primary (--primitive-blue)"
            hex={colors.primitives.blue}
            cssVar="--brand-primary"
          />
          <OpacityRow
            label="primary-500"
            hex={colors.primary["500"]}
            cssVar="--qagrotis-primary-500"
          />
          <OpacityRow
            label="secondary-500"
            hex={colors.secondary["500"]}
            cssVar="--qagrotis-secondary-500"
          />
          <OpacityRow
            label="text-primary (dark)"
            hex={colors.semantic.textPrimary}
            cssVar="--text-primary"
          />
          <OpacityRow
            label="neutral-grey-900"
            hex={colors.neutralGrey["900"]}
            cssVar="--neutral-grey-900"
          />
        </div>
      </Section>
    </div>
  )
}

// ── Meta ──────────────────────────────────────────────────────

const meta: Meta = {
  title: "Design Tokens/Colors",
  component: ColorsPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Paleta completa QAgrotis: tokens semânticos, escala primária (10 tons), escala secundária (10 tons), neutral-grey e cores com opacidade.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ColorsPage>

export const Colors: Story = {}
