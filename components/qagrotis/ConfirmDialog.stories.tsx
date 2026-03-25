import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"

const meta: Meta<typeof ConfirmDialog> = {
  title: "QAgrotis/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Dialog de confirmação para ações destrutivas (inativar cenário, suíte, usuário). Reutilizável com `title`, `description` e `confirmLabel` customizáveis.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const InativarCenario: Story = {
  name: "Inativar cenário",
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Abrir diálogo
          </Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Deseja inativar?"
            description="O cenário CEN-0042 será inativado de forma definitiva e não poderá ser recuperado. Caso seja necessário utilizá-lo novamente, será preciso cadastrar um novo cenário."
            confirmLabel="Inativar"
            onConfirm={() => setOpen(false)}
          />
        </>
      )
    }
    return <Demo />
  },
}

export const InativarSuite: Story = {
  name: "Inativar suíte",
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Abrir diálogo
          </Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title="Deseja inativar?"
            description="A suíte SUI-0017 será inativada de forma definitiva e não poderá ser recuperada."
            confirmLabel="Inativar"
            onConfirm={() => setOpen(false)}
          />
        </>
      )
    }
    return <Demo />
  },
}
