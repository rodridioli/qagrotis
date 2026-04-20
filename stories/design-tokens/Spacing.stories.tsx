import type { Meta, StoryObj } from "@storybook/nextjs-vite"

function SpacingPage() {
  // Extended Tailwind-like scale for reference
  const extendedScale: { token: string; value: string; note?: string }[] = [
    { token: "spacing-1 (agro-1)", value: "8px",  note: "QAgrotis base unit" },
    { token: "spacing-2 (agro-2)", value: "16px", note: "2× base" },
    { token: "spacing-3 (agro-3)", value: "24px", note: "3× base" },
    { token: "spacing-4 (agro-4)", value: "32px", note: "4× base" },
    { token: "—",                  value: "40px", note: "5× base (referência)" },
    { token: "—",                  value: "48px", note: "6× base (referência)" },
    { token: "—",                  value: "64px", note: "8× base (referência)" },
  ]

  return (
    <div className="flex flex-col gap-10 bg-surface-default p-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Spacing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Grid base de{" "}
          <strong className="font-semibold text-text-primary">8px</strong>. Tokens
          QAgrotis: <code className="font-mono text-xs">--spacing-agro-1</code> →{" "}
          <code className="font-mono text-xs">--spacing-agro-4</code>. Utilities
          Tailwind: <code className="font-mono text-xs">p-agro-2</code>,{" "}
          <code className="font-mono text-xs">gap-agro-3</code>, etc.
        </p>
      </div>

      {/* Visual scale */}
      <div className="flex flex-col gap-3">
        {extendedScale.map(({ token, value, note }) => {
          const isToken = token !== "—"
          return (
            <div
              key={`${token}-${value}`}
              className="flex items-center gap-4 rounded-custom border border-border-default bg-surface-card px-5 py-4"
            >
              {/* Label */}
              <div className="flex w-52 shrink-0 flex-col gap-0.5">
                <span
                  className="font-mono text-sm font-medium"
                  style={{ color: isToken ? "#5c7cfa" : "#9ca3af" }}
                >
                  {token}
                </span>
                {note && (
                  <span className="text-xs text-text-secondary">{note}</span>
                )}
              </div>

              {/* Bar */}
              <div className="flex flex-1 items-center gap-3">
                <div
                  className="h-7 rounded-custom"
                  style={{
                    width: value,
                    background: isToken
                      ? "var(--brand-primary, #5c7cfa)"
                      : "#d1d5db",
                  }}
                />
                <span className="font-mono text-xs text-neutral-grey-400">
                  {value}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Practical examples */}
      <div className="flex flex-col gap-4">
        <h2 className="border-b border-border-default pb-2 text-lg font-semibold text-text-primary">
          Exemplos Práticos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* gap example */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="font-mono text-xs text-text-secondary">
              gap-agro-1 (8px)
            </p>
            <div className="flex" style={{ gap: "8px" }}>
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="flex h-8 w-8 items-center justify-center rounded-custom bg-primary-100 text-xs font-bold text-brand-primary"
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          {/* padding example */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="font-mono text-xs text-text-secondary">
              p-agro-2 (16px)
            </p>
            <div
              className="rounded-custom bg-primary-50"
              style={{ padding: "16px" }}
            >
              <div className="h-6 w-full rounded-custom bg-primary-200" />
            </div>
          </div>

          {/* margin example */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="font-mono text-xs text-text-secondary">
              gap-agro-3 (24px)
            </p>
            <div className="flex flex-col" style={{ gap: "24px" }}>
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="h-8 w-full rounded-custom bg-secondary-100"
                />
              ))}
            </div>
          </div>

          {/* section spacing */}
          <div className="flex flex-col gap-3 rounded-custom border border-border-default bg-surface-card p-5 shadow-card">
            <p className="font-mono text-xs text-text-secondary">
              p-agro-4 (32px)
            </p>
            <div
              className="rounded-custom bg-surface-default"
              style={{ padding: "32px" }}
            >
              <div className="h-6 w-full rounded-custom bg-neutral-grey-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const meta: Meta = {
  title: "Design Tokens/Spaces",
  component: SpacingPage,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof SpacingPage>

export const Spaces: Story = {}
