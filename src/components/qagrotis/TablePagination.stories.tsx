import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { TablePagination } from "@/components/qagrotis/TablePagination"

const meta: Meta<typeof TablePagination> = {
  title: "QAgrotis/TablePagination",
  component: TablePagination,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Rodapé de paginação com contagem de itens e controles de navegação entre páginas.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof TablePagination>

export const Default: Story = {
  render: () => {
    function Demo() {
      const [page, setPage] = useState(1)
      return (
        <div className="rounded-xl border border-border-default bg-surface-card">
          <TablePagination
            currentPage={page}
            totalPages={100}
            totalItems={1000}
            itemsPerPage={10}
            onPageChange={setPage}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const FirstPage: Story = {
  name: "Primeira página (prev desabilitado)",
  render: () => (
    <div className="rounded-xl border border-border-default bg-surface-card">
      <TablePagination
        currentPage={1}
        totalPages={10}
        totalItems={98}
        itemsPerPage={10}
        onPageChange={() => {}}
      />
    </div>
  ),
}

export const LastPage: Story = {
  name: "Última página (next desabilitado)",
  render: () => (
    <div className="rounded-xl border border-border-default bg-surface-card">
      <TablePagination
        currentPage={10}
        totalPages={10}
        totalItems={98}
        itemsPerPage={10}
        onPageChange={() => {}}
      />
    </div>
  ),
}

export const SinglePage: Story = {
  name: "Página única (ambos desabilitados)",
  render: () => (
    <div className="rounded-xl border border-border-default bg-surface-card">
      <TablePagination
        currentPage={1}
        totalPages={1}
        totalItems={7}
        itemsPerPage={10}
        onPageChange={() => {}}
      />
    </div>
  ),
}
