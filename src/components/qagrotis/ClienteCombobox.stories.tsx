import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { ClienteCombobox } from "@/components/qagrotis/ClienteCombobox"

const MOCK_CLIENTES = [
  { id: "CLI-1", nomeFantasia: "Agro Sul Ltda" },
  { id: "CLI-2", nomeFantasia: "Campo Verde S/A" },
  { id: "CLI-3", nomeFantasia: "Terra Viva Cooperativa" },
]

const meta: Meta<typeof ClienteCombobox> = {
  title: "QAgrotis/ClienteCombobox",
  component: ClienteCombobox,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Combobox com busca para seleção de cliente. Suporta estado `disabled` para quando o cliente vinculado está inativo — exibe o valor atual em modo somente leitura.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ClienteCombobox>

export const Default: Story = {
  name: "Padrão",
  render: () => {
    function Demo() {
      const [value, setValue] = useState("")
      return (
        <div className="w-72">
          <ClienteCombobox
            clientes={MOCK_CLIENTES}
            value={value}
            onChange={setValue}
            onAddCliente={() => alert("Adicionar cliente")}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const WithValue: Story = {
  name: "Com valor selecionado",
  render: () => {
    function Demo() {
      const [value, setValue] = useState("Agro Sul Ltda")
      return (
        <div className="w-72">
          <ClienteCombobox
            clientes={MOCK_CLIENTES}
            value={value}
            onChange={setValue}
            onAddCliente={() => alert("Adicionar cliente")}
          />
        </div>
      )
    }
    return <Demo />
  },
}

export const Disabled: Story = {
  name: "Desabilitado (cliente inativo)",
  render: () => (
    <div className="w-72 space-y-1.5">
      <ClienteCombobox
        clientes={[{ id: "", nomeFantasia: "Empresa Inativa Ltda" }]}
        value="Empresa Inativa Ltda"
        onChange={() => {}}
        onAddCliente={() => {}}
        disabled
      />
      <p className="text-xs text-text-secondary">Cliente inativo — campo somente leitura.</p>
    </div>
  ),
}

export const Empty: Story = {
  name: "Sem clientes cadastrados",
  render: () => {
    function Demo() {
      const [value, setValue] = useState("")
      return (
        <div className="w-72">
          <ClienteCombobox
            clientes={[]}
            value={value}
            onChange={setValue}
            onAddCliente={() => alert("Adicionar cliente")}
          />
        </div>
      )
    }
    return <Demo />
  },
}
