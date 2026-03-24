import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { qagrotisTokens } from "@/design-system/tokens"

// ── Column highlight ──────────────────────────────────────────

function Col({ span, children }: { span?: string; children?: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-10 items-center justify-center rounded-custom bg-brand-primary/10 ring-1 ring-brand-primary/30"
      style={{ gridColumn: span }}
    >
      <span className="font-mono text-xs font-semibold text-brand-primary">
        {children}
      </span>
    </div>
  )
}

function Section({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-border-default pb-2">
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function GridPage() {
  const { spacing } = qagrotisTokens

  return (
    <div className="flex flex-col gap-12 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Grid</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Sistema de grid do QAgrotis: base-8px para espaçamento interno,
          12 colunas para layouts de página. Gutter padrão:{" "}
          <strong className="font-semibold text-text-primary">24px (spacing-3)</strong>.
        </p>
      </div>

      {/* Base unit */}
      <Section
        title="Unidade Base — 8px"
        description="Todas as distâncias são múltiplos de 8px. O grid de 8px garante consistência visual em toda a interface."
      >
        <div className="rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
          <div className="flex items-end gap-0">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className="bg-brand-primary/20"
                  style={{ width: 8 * n, height: 8 * n }}
                />
                <span className="font-mono text-[10px] text-neutral-grey-400">
                  {8 * n}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4">
            {Object.entries(spacing).map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col items-center gap-1 rounded-custom bg-primary-50 px-3 py-2"
              >
                <span className="font-mono text-xs font-bold text-brand-primary">
                  agro-{key}
                </span>
                <span className="font-mono text-xs text-text-secondary">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 12-column grid */}
      <Section
        title="Grid de 12 Colunas"
        description="Layout de página. Gutter: 24px (gap-agro-3). Use Tailwind grid-cols-12 com gap-6."
      >
        <div className="rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
          {/* Column numbers */}
          <div className="mb-2 grid grid-cols-12 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="text-center font-mono text-[10px] text-neutral-grey-400">
                {i + 1}
              </div>
            ))}
          </div>
          {/* Full 12 cols */}
          <div className="grid grid-cols-12 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="h-8 rounded-custom bg-brand-primary/10 ring-1 ring-brand-primary/20"
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Common layouts */}
      <Section
        title="Layouts Comuns"
        description="Exemplos de composições com o grid de 12 colunas."
      >
        <div className="flex flex-col gap-4">
          {/* 12 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-12 — Largura total (full-width)
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 12">12</Col>
            </div>
          </div>

          {/* 6 + 6 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-6 + col-span-6 — Duas colunas iguais
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 6">6</Col>
              <Col span="span 6">6</Col>
            </div>
          </div>

          {/* 4 + 4 + 4 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-4 × 3 — Três cards iguais
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 4">4</Col>
              <Col span="span 4">4</Col>
              <Col span="span 4">4</Col>
            </div>
          </div>

          {/* 3 × 4 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-3 × 4 — Quatro cards (dashboard KPIs)
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 3">3</Col>
              <Col span="span 3">3</Col>
              <Col span="span 3">3</Col>
              <Col span="span 3">3</Col>
            </div>
          </div>

          {/* Sidebar layout: 3 + 9 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-3 + col-span-9 — Sidebar + conteúdo principal
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 3">sidebar</Col>
              <Col span="span 9">main</Col>
            </div>
          </div>

          {/* Form layout: 8 + 4 */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs text-text-secondary">
              col-span-8 + col-span-4 — Formulário + painel de ajuda
            </p>
            <div className="grid grid-cols-12 gap-2 rounded-custom border border-border-default bg-surface-card p-3">
              <Col span="span 8">form</Col>
              <Col span="span 4">help</Col>
            </div>
          </div>
        </div>
      </Section>

      {/* Responsive breakpoints */}
      <Section
        title="Breakpoints de Referência"
        description="O Tailwind v4 utiliza os breakpoints padrão — combinar com grid-cols para layouts responsivos."
      >
        <div className="overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-surface-default">
              <tr>
                {["Prefix", "Mín. Width", "Uso típico"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left font-semibold text-text-primary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {[
                { prefix: "(base)", width: "0px",    usage: "Mobile — col-span-12" },
                { prefix: "sm:",    width: "640px",  usage: "Tablet portrait — col-span-6" },
                { prefix: "md:",    width: "768px",  usage: "Tablet landscape — col-span-4" },
                { prefix: "lg:",    width: "1024px", usage: "Desktop — col-span-3" },
                { prefix: "xl:",    width: "1280px", usage: "Widescreen" },
                { prefix: "2xl:",   width: "1536px", usage: "Ultra-wide" },
              ].map((row) => (
                <tr key={row.prefix} className="transition-colors hover:bg-surface-default">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-brand-primary">
                    {row.prefix}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                    {row.width}
                  </td>
                  <td className="px-5 py-3 text-xs text-text-secondary">{row.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Grid",
  component: GridPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof GridPage>

export const Grid: Story = {}
