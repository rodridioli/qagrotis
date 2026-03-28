import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { Calendar } from "lucide-react"
import { TableToolbar } from "@/components/qagrotis/TableToolbar"

const meta: Meta<typeof TableToolbar> = {
  title: "QAgrotis/TableToolbar",
  component: TableToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Barra de ferramentas de tabela com busca e botão de filtro com contador de filtros ativos. Aceita `extra` para botões adicionais.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof TableToolbar>

export const Default: Story = {
  render: () => {
    function Demo() {
      const [search, setSearch] = useState("")
      return (
        <div className="rounded-xl border border-border-default bg-surface-card">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por Id e Cenário"
            activeFilterCount={0}
            onFilterOpen={() => alert("Abrir filtros")}
            totalLabel="Total de cenários"
            totalCount={1284}
            baseCount={1284}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const WithActiveFilters: Story = {
  name: "Com filtros ativos",
  render: () => {
    function Demo() {
      const [search, setSearch] = useState("Cadastro")
      return (
        <div className="rounded-xl border border-border-default bg-surface-card">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar..."
            activeFilterCount={3}
            onFilterOpen={() => {}}
            totalLabel="Suítes de teste"
            totalCount={87}
            baseCount={87}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const WithExtraButton: Story = {
  name: "Com botão extra (calendário)",
  render: () => {
    function Demo() {
      const [search, setSearch] = useState("")
      return (
        <div className="rounded-xl border border-border-default bg-surface-card">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por Id e Suíte"
            activeFilterCount={1}
            onFilterOpen={() => {}}
            totalLabel="Suítes de teste"
            totalCount={512}
            baseCount={512}
            extra={
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-lg border border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
              >
                <Calendar className="size-4" />
              </button>
            }
          />
        </div>
      )
    }
    return <Demo />
  },
}
