import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const meta: Meta = {
  title: "Components/Dialog",
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialog built on `@base-ui/react/dialog`. Uses `rounded-custom` (`--radius-control`, 0.5em), `bg-surface-card`, and `shadow-card` tokens. Backdrop applies `bg-black/10` with a blur.",
      },
    },
  },
}

export default meta
type Story = StoryObj

// ── Default ───────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="default" />}>
        Abrir modal
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar execução</DialogTitle>
          <DialogDescription>
            Esta ação irá iniciar a suíte de testes selecionada no ambiente de
            homologação. Tem certeza que deseja continuar?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="default">Executar testes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// ── Destructive ───────────────────────────────────────────────

export const Destructive: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" />}>
        Excluir suite
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir suíte de testes?</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. Todos os casos de teste e histórico de
            execuções serão permanentemente removidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="destructive">Excluir permanentemente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}

// ── Without Close Button ──────────────────────────────────────

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Modal sem botão X
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Processando resultados</DialogTitle>
          <DialogDescription>
            Aguarde enquanto sincronizamos os relatórios de teste.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button variant="default">Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
