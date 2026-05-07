import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"

const meta: Meta = {
  title: "Components/Select",
  parameters: {
    docs: {
      description: {
        component:
          "Dropdown select built on `@base-ui/react/select`. Styled with `surface-input`, `border-default`, and `brand-primary` tokens.",
      },
    },
  },
}

export default meta
type Story = StoryObj

// ── Default ───────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <div className="w-64 p-4">
      <Select defaultValue="jest">
        <SelectTrigger>
          <SelectValue placeholder="Selecione um framework…" />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="jest">Jest</SelectItem>
          <SelectItem value="vitest">Vitest</SelectItem>
          <SelectItem value="playwright">Playwright</SelectItem>
          <SelectItem value="cypress">Cypress</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
}

// ── Placeholder ───────────────────────────────────────────────

export const WithPlaceholder: Story = {
  render: () => (
    <div className="w-64 p-4">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um status…" />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="passed">Passou</SelectItem>
          <SelectItem value="failed">Falhou</SelectItem>
          <SelectItem value="pending">Pendente</SelectItem>
          <SelectItem value="skipped">Ignorado</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
}

// ── Grouped ───────────────────────────────────────────────────

export const Grouped: Story = {
  render: () => (
    <div className="w-64 p-4">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Selecione um ambiente…" />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            <SelectLabel>Produção</SelectLabel>
            <SelectItem value="prod-br">Brasil</SelectItem>
            <SelectItem value="prod-us">EUA</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Homologação</SelectLabel>
            <SelectItem value="staging-br">Brasil (staging)</SelectItem>
            <SelectItem value="staging-us">EUA (staging)</SelectItem>
          </SelectGroup>
        </SelectPopup>
      </Select>
    </div>
  ),
}

// ── Disabled ──────────────────────────────────────────────────

export const Disabled: Story = {
  render: () => (
    <div className="w-64 p-4">
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Desabilitado" />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="a">Opção A</SelectItem>
        </SelectPopup>
      </Select>
    </div>
  ),
}
