import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const BREAKPOINTS = [
  {
    prefix: "base",
    minWidth: 0,
    maxWidth: 639,
    label: "Mobile",
    icon: "📱",
    cols: 4,
    description: "Layout de coluna única. Navegação em bottom bar ou drawer.",
    example: "grid-cols-1 / col-span-4",
    color: "#5c7cfa",
  },
  {
    prefix: "sm",
    minWidth: 640,
    maxWidth: 767,
    label: "Tablet Portrait",
    icon: "📱",
    cols: 8,
    description: "2 colunas para cards. Sidebar colapsada.",
    example: "sm:grid-cols-2 / sm:col-span-4",
    color: "#4360e8",
  },
  {
    prefix: "md",
    minWidth: 768,
    maxWidth: 1023,
    label: "Tablet Landscape",
    icon: "💻",
    cols: 8,
    description: "3 colunas. Sidebar pode ser fixa.",
    example: "md:grid-cols-3 / md:col-span-3",
    color: "#3549c5",
  },
  {
    prefix: "lg",
    minWidth: 1024,
    maxWidth: 1279,
    label: "Desktop",
    icon: "🖥️",
    cols: 12,
    description: "Layout completo de 12 colunas. Sidebar fixa.",
    example: "lg:grid-cols-4 / lg:col-span-3",
    color: "#2c3a99",
  },
  {
    prefix: "xl",
    minWidth: 1280,
    maxWidth: 1535,
    label: "Widescreen",
    icon: "🖥️",
    cols: 12,
    description: "Conteúdo com max-width e padding lateral aumentado.",
    example: "xl:grid-cols-5 / xl:max-w-7xl",
    color: "#1e2a6e",
  },
  {
    prefix: "2xl",
    minWidth: 1536,
    maxWidth: null,
    label: "Ultra-wide",
    icon: "🖥️",
    cols: 12,
    description: "Restrição via container. Evitar layouts que se esticam além de 1536px.",
    example: "2xl:max-w-screen-2xl mx-auto",
    color: "#111827",
  },
]

const COMMON_PATTERNS = [
  {
    label: "Cards de dashboard (KPIs)",
    code: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    preview: [
      { mobile: 12, sm: 6, lg: 3 },
      { mobile: 12, sm: 6, lg: 3 },
      { mobile: 12, sm: 6, lg: 3 },
      { mobile: 12, sm: 6, lg: 3 },
    ],
  },
  {
    label: "Lista de itens (3 colunas)",
    code: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
    preview: [
      { mobile: 12, sm: 6, xl: 4 },
      { mobile: 12, sm: 6, xl: 4 },
      { mobile: 12, sm: 12, xl: 4 },
    ],
  },
  {
    label: "Sidebar + Conteúdo",
    code: "grid-cols-1 lg:grid-cols-[280px_1fr]",
    preview: [
      { label: "sidebar", mobile: 12, lg: 3 },
      { label: "main", mobile: 12, lg: 9 },
    ],
  },
]

// ── Visual bar showing breakpoint range ───────────────────────

function BreakpointBar({
  minWidth,
  maxWidth,
  color,
}: {
  minWidth: number
  maxWidth: number | null
  color: string
}) {
  const MAX = 1536
  const left  = Math.min((minWidth / MAX) * 100, 100)
  const width = maxWidth
    ? Math.min(((maxWidth - minWidth) / MAX) * 100, 100 - left)
    : 100 - left

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-grey-100">
      <div
        className="absolute top-0 h-full rounded-full"
        style={{ left: `${left}%`, width: `${width}%`, background: color }}
      />
    </div>
  )
}

// ── Breakpoint card ───────────────────────────────────────────

function BreakpointCard({
  prefix,
  minWidth,
  maxWidth,
  label,
  cols,
  description,
  example,
  color,
}: (typeof BREAKPOINTS)[0]) {
  return (
    <div className="flex flex-col overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
      {/* Header band */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: color }}
      >
        <span className="font-mono text-sm font-bold text-white">
          {prefix === "base" ? "(base)" : `${prefix}:`}
        </span>
        <span className="rounded bg-white/20 px-2 py-0.5 font-mono text-xs font-semibold text-white">
          {label}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Width range */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-text-primary">
            {minWidth}px{maxWidth ? ` – ${maxWidth}px` : "+"}
          </span>
          <span className="font-mono text-xs text-neutral-grey-400">
            {cols} cols
          </span>
        </div>

        {/* Bar */}
        <BreakpointBar minWidth={minWidth} maxWidth={maxWidth} color={color} />

        {/* Description */}
        <p className="text-xs text-text-secondary">{description}</p>

        {/* Example utility */}
        <div className="rounded-custom bg-surface-default px-2 py-1.5">
          <code className="font-mono text-[10px] text-brand-primary">{example}</code>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

function BreakpointsPage() {
  return (
    <div className="flex flex-col gap-12 bg-surface-default p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Breakpoints</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tailwind v4 usa os breakpoints padrão{" "}
          <strong className="font-semibold text-text-primary">mobile-first</strong>.
          Todos os prefixos (<code className="font-mono text-xs">sm:</code>,{" "}
          <code className="font-mono text-xs">md:</code>…) aplicam-se a partir do
          valor mínimo definido.
        </p>
      </div>

      {/* Overview ruler */}
      <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
        <h2 className="text-sm font-semibold text-text-primary">Visão Geral</h2>
        <div className="flex flex-col gap-2">
          {/* Scale ruler */}
          <div className="relative h-6 w-full overflow-hidden rounded-custom bg-neutral-grey-100">
            {BREAKPOINTS.map(({ prefix, minWidth, maxWidth, color }) => {
              const MAX = 1536
              const left  = Math.min((minWidth / MAX) * 100, 100)
              const width = maxWidth
                ? Math.min(((maxWidth - minWidth) / MAX) * 100, 100 - left)
                : 100 - left
              return (
                <div
                  key={prefix}
                  className="absolute top-0 flex h-full items-center justify-center"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: color,
                    borderRight: "1px solid rgba(255,255,255,0.3)",
                  }}
                >
                  <span className="font-mono text-[9px] font-bold text-white">
                    {prefix === "base" ? "—" : prefix}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Tick marks */}
          <div className="relative h-4 w-full">
            {BREAKPOINTS.map(({ prefix, minWidth }) => {
              const MAX = 1536
              const left = Math.min((minWidth / MAX) * 100, 100)
              return (
                <div
                  key={prefix}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                >
                  <span className="font-mono text-[9px] text-neutral-grey-400">
                    {minWidth === 0 ? "0" : `${minWidth}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Breakpoints Detalhados
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BREAKPOINTS.map((bp) => (
            <BreakpointCard key={bp.prefix} {...bp} />
          ))}
        </div>
      </div>

      {/* Reference table */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Tabela de Referência
        </h2>
        <div className="overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-surface-default">
              <tr>
                {["Prefixo", "Min-width", "Max-width", "Container", "Colunas"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {[
                { prefix: "(base)",  min: "0px",    max: "639px",   container: "100%",    cols: 4  },
                { prefix: "sm:",     min: "640px",  max: "767px",   container: "640px",   cols: 8  },
                { prefix: "md:",     min: "768px",  max: "1023px",  container: "768px",   cols: 8  },
                { prefix: "lg:",     min: "1024px", max: "1279px",  container: "1024px",  cols: 12 },
                { prefix: "xl:",     min: "1280px", max: "1535px",  container: "1280px",  cols: 12 },
                { prefix: "2xl:",    min: "1536px", max: "—",       container: "1536px",  cols: 12 },
              ].map((row) => (
                <tr
                  key={row.prefix}
                  className="transition-colors hover:bg-surface-default"
                >
                  <td className="px-5 py-3 font-mono text-xs font-bold text-brand-primary">
                    {row.prefix}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-primary">
                    {row.min}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {row.max}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {row.container}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {row.cols}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Common patterns */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Padrões Responsivos Comuns
        </h2>
        <div className="flex flex-col gap-5">
          {COMMON_PATTERNS.map(({ label, code, preview }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">{label}</p>
                <code className="rounded bg-surface-default px-2 py-1 font-mono text-xs text-brand-primary">
                  {code}
                </code>
              </div>

              {/* Visual grid preview (desktop view) */}
              <div className="flex gap-2">
                {preview.map((col, i) => {
                  const lgSpan = "lg" in col ? (col as Record<string, number>).lg
                    : "xl" in col ? (col as Record<string, number>).xl
                    : undefined
                  const span = lgSpan ?? 3
                  return (
                    <div
                      key={i}
                      className="flex min-h-10 items-center justify-center rounded-custom bg-primary-100 ring-1 ring-primary-300"
                      style={{ flex: span }}
                    >
                      {"label" in col ? (
                        <span className="font-mono text-xs font-semibold text-brand-primary">
                          {(col as { label?: string }).label}
                        </span>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-brand-primary">
                          col
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="font-mono text-xs text-neutral-grey-400">
                Preview: layout desktop (lg+)
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Breakpoints",
  component: BreakpointsPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof BreakpointsPage>

export const Breakpoints: Story = {}
