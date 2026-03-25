import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Pencil, MoreVertical } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

// ── TipoBadge ─────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === "Administrador") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-medium text-secondary-600">
      {tipo}
    </span>
  )
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

// ── Sample data ────────────────────────────────────────────────────────────
const SAMPLE_USERS = [
  { id: "U-00", name: "Rodrigo Dioli", email: "rodridioli@gmail.com", type: "Administrador" },
  { id: "U-01", name: "Ana Silva",     email: "ana.silva1@empresa.com.br",    type: "Padrão" },
  { id: "U-02", name: "Bruno Santos",  email: "bruno.santos2@empresa.com.br",  type: "Administrador" },
  { id: "U-03", name: "Carlos Oliveira", email: "carlos.oliveira3@empresa.com.br", type: "Padrão" },
]

// ── Badge stories ──────────────────────────────────────────────────────────
const meta: Meta = {
  title: "QAgrotis/TipoBadge",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Badge de tipo de usuário. **Administrador** usa `brand-primary/10` com borda `brand-primary/30`. **Padrão** usa `secondary-500/10` com borda `secondary-500/30`. Ambos têm forma de pílula (`rounded-full`).",
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Administrador: Story = {
  render: () => <TipoBadge tipo="Administrador" />,
}

export const Padrao: Story = {
  name: "Padrão",
  render: () => <TipoBadge tipo="Padrão" />,
}

export const AmbosLadoALado: Story = {
  name: "Ambos lado a lado",
  render: () => (
    <div className="flex items-center gap-3">
      <TipoBadge tipo="Administrador" />
      <TipoBadge tipo="Padrão" />
    </div>
  ),
}

// ── Users table row stories ────────────────────────────────────────────────
export const TabelaUsuariosAdmin: Story = {
  name: "Tabela — visão Administrador",
  parameters: {
    docs: {
      description: {
        story:
          "Tabela completa com checkboxes e dropdown de ações. A linha do próprio usuário logado (U-00) exibe ícone de lápis e checkbox desabilitado. As demais exibem `MoreVertical` com opções Visualizar e Inativar.",
      },
    },
  },
  render: () => {
    const currentUserId = "U-00"
    return (
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-4 py-3 text-left">
                <Checkbox checked={false} onChange={() => {}} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Id</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuário</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">E-mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {SAMPLE_USERS.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <tr key={u.id} className="border-b border-border-default last:border-0 hover:bg-neutral-grey-50 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={false}
                      onChange={() => {}}
                      disabled={isSelf}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-text-secondary">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-brand-primary">
                        {getInitials(u.name)}
                      </div>
                      <span className="font-medium text-text-primary">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3"><TipoBadge tipo={u.type} /></td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <button
                        type="button"
                        title="Editar meu cadastro"
                        className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  },
}

export const TabelaUsuariosPadrao: Story = {
  name: "Tabela — visão Padrão (sem ações)",
  parameters: {
    docs: {
      description: {
        story:
          "Usuário do tipo Padrão não vê checkboxes nem coluna de ações. A linha do próprio usuário ainda exibe o ícone de lápis.",
      },
    },
  },
  render: () => {
    const currentUserId = "U-01"
    return (
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-neutral-grey-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Id</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Usuário</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">E-mail</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {SAMPLE_USERS.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <tr key={u.id} className="border-b border-border-default last:border-0 hover:bg-neutral-grey-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-secondary">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-brand-primary">
                        {getInitials(u.name)}
                      </div>
                      <span className="font-medium text-text-primary">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3"><TipoBadge tipo={u.type} /></td>
                  <td className="px-4 py-3">
                    {isSelf && (
                      <button
                        type="button"
                        title="Editar meu cadastro"
                        className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
                      >
                        <Pencil className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  },
}
