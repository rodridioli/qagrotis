import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import React, { useState } from "react"
import { ArrowDown, ArrowUp, Circle } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"

// ── Risco options (same as NovoCenarioClient) ───────────────────────────────

const RISCO_OPTIONS = [
  { value: "Alto",  label: "Alto",  icon: <ArrowUp  className="size-3.5 shrink-0" />, color: "#ef4444" },
  { value: "Médio", label: "Médio", icon: <Circle   className="size-3.5 shrink-0 fill-amber-400" />, color: "#f59e0b" },
  { value: "Baixo", label: "Baixo", icon: <ArrowDown className="size-3.5 shrink-0" />, color: "#3b82f6" },
] as const

function RiscoSelectDemo() {
  const [risco, setRisco] = useState("")
  const selected = RISCO_OPTIONS.find((r) => r.value === risco)

  return (
    <div className="w-48">
      <Select value={risco} onValueChange={(v) => setRisco(v ?? "")}>
        <SelectTrigger>
          {selected ? (
            <span className="flex items-center gap-1.5 font-bold" style={{ color: selected.color }}>
              <span style={{ color: selected.color }}>{selected.icon}</span>
              {selected.label}
            </span>
          ) : (
            <span className="text-text-secondary">Selecionar</span>
          )}
        </SelectTrigger>
        <SelectPopup>
          {RISCO_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              <span className="flex items-center gap-1.5 font-bold" style={{ color: r.color }}>
                <span style={{ color: r.color }}>{r.icon}</span>
                {r.label}
              </span>
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  )
}

// ── Meta ────────────────────────────────────────────────────────────────────

const meta: Meta = {
  title: "QAgrotis/RiscoSelect",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
Select de Risco usado no cadastro de cenários.

### Valores
| Valor | Ícone | Cor |
|-------|-------|-----|
| Alto | ArrowUp | \`#ef4444\` (red-500) |
| Médio | Circle (preenchido) | \`#f59e0b\` (amber-400) |
| Baixo | ArrowDown | \`#3b82f6\` (blue-500) |

### Implementação
O componente usa um **Select controlado** com conteúdo customizado no \`SelectTrigger\`.
Isso é necessário porque o \`SelectValue\` do Base UI espelha apenas texto,
descartando ícones e estilos inline. A abordagem com \`style={{ color }}\` garante
que as cores funcionem independente da ordem das classes Tailwind no bundle.
        `,
      },
    },
  },
}

export default meta
type Story = StoryObj

export const Default: Story = {
  name: "Interativo",
  render: () => <RiscoSelectDemo />,
}

export const AllOptions: Story = {
  name: "Todas as opções",
  parameters: {
    docs: {
      description: { story: "Prévia estática de cada opção de risco com ícone e cor." },
    },
  },
  render: () => (
    <div className="flex flex-col gap-2 p-4">
      {RISCO_OPTIONS.map((r) => (
        <span
          key={r.value}
          className="flex w-fit items-center gap-1.5 font-bold"
          style={{ color: r.color }}
        >
          <span style={{ color: r.color }}>{r.icon}</span>
          {r.label}
        </span>
      ))}
    </div>
  ),
}
