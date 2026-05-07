import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { qagrotisTokens } from "@/design-system/tokens"

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

function TypographyPage() {
  const { typography } = qagrotisTokens

  const sizeEntries  = Object.entries(typography.fontSize)  as [string, string][]
  const weightEntries = Object.entries(typography.fontWeight) as [string, string][]

  const weightLabels: Record<string, string> = {
    regular: "Regular",
    medium: "Medium",
    semibold: "Semibold",
    bold: "Bold",
  }

  return (
    <div className="flex flex-col gap-14 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Typography</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Fonte{" "}
          <strong className="font-semibold text-text-primary">Roboto</strong>{" "}
          carregada via{" "}
          <code className="rounded bg-surface-card px-1 py-0.5 font-mono text-xs">
            next/font/google
          </code>
          . Line-height padrão:{" "}
          <code className="font-mono text-xs">{typography.lineHeight.default}</code>.
        </p>
      </div>

      {/* Scale */}
      <Section
        title="Escala de Tamanhos"
        description="Cinco tamanhos semânticos. Utility: text-sm, text-base, text-lg, text-xl, text-2xl."
      >
        <div className="flex flex-col divide-y divide-border-default overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          {sizeEntries.map(([name, size], i) => (
            <div
              key={name}
              className="flex items-baseline gap-6 px-6 py-5"
            >
              {/* Token info */}
              <div className="flex w-40 shrink-0 flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold text-brand-primary">
                  text-{name}
                </span>
                <span className="font-mono text-xs text-neutral-grey-400">
                  {size} / lh {typography.lineHeight.default}
                </span>
              </div>

              {/* Live preview */}
              <span
                className="flex-1 text-text-primary"
                style={{
                  fontSize: size,
                  fontFamily: "var(--font-roboto)",
                  lineHeight: typography.lineHeight.default,
                  fontWeight: i === 0 ? 400 : 400,
                }}
              >
                O sistema de testes agrícolas do futuro.
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Weights */}
      <Section
        title="Pesos"
        description="Quatro variações de peso. Token: font-weight regular → bold."
      >
        <div className="flex flex-col divide-y divide-border-default overflow-hidden rounded-custom border border-border-default bg-surface-card shadow-card">
          {weightEntries.map(([name, weight]) => (
            <div key={name} className="flex items-center gap-6 px-6 py-5">
              {/* Token info */}
              <div className="flex w-40 shrink-0 flex-col gap-0.5">
                <span className="font-mono text-xs font-semibold text-brand-primary">
                  {name}
                </span>
                <span className="font-mono text-xs text-neutral-grey-400">
                  font-weight: {weight}
                </span>
              </div>

              {/* Live preview */}
              <span
                className="flex-1 text-base text-text-primary"
                style={{
                  fontFamily: "var(--font-roboto)",
                  fontWeight: weight,
                  lineHeight: typography.lineHeight.default,
                }}
              >
                {weightLabels[name] ?? name} — The quick brown fox jumps over the lazy dog.
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Combinações recomendadas */}
      <Section
        title="Combinações Recomendadas"
        description="Padrões de uso em componentes reais do QAgrotis."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card title */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Título de card
            </p>
            <p
              className="text-xl text-text-primary"
              style={{ fontFamily: "var(--font-roboto)", fontWeight: 600 }}
            >
              Suíte de Testes #42
            </p>
            <p className="font-mono text-xs text-neutral-grey-400">
              text-xl / semibold
            </p>
          </div>

          {/* Body text */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Corpo de texto
            </p>
            <p
              className="text-base text-text-primary"
              style={{ fontFamily: "var(--font-roboto)", fontWeight: 400, lineHeight: 1.6 }}
            >
              Resultado da execução concluída às 14h32. Todos os casos de teste
              foram processados com sucesso.
            </p>
            <p className="font-mono text-xs text-neutral-grey-400">
              text-base / regular / lh 1.6
            </p>
          </div>

          {/* Label */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Label de formulário
            </p>
            <p
              className="text-sm text-text-primary"
              style={{ fontFamily: "var(--font-roboto)", fontWeight: 500 }}
            >
              Nome do ambiente
            </p>
            <p className="font-mono text-xs text-neutral-grey-400">
              text-sm / medium
            </p>
          </div>

          {/* Caption */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-grey-400">
              Caption / metadado
            </p>
            <p
              className="text-sm text-text-secondary"
              style={{ fontFamily: "var(--font-roboto)", fontWeight: 400 }}
            >
              Executado há 2 horas por João Silva
            </p>
            <p className="font-mono text-xs text-neutral-grey-400">
              text-sm / regular / text-text-secondary
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Typography",
  component: TypographyPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Escala tipográfica Roboto do QAgrotis: tamanhos, pesos e combinações recomendadas.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof TypographyPage>

export const Typography: Story = {}
