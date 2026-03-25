import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Container card with header, content, and footer slots. Supports `default` and `sm` sizes.",
      },
    },
  },
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
    },
  },
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Suíte de Regressão</CardTitle>
        <CardDescription>Módulo Financeiro — v2.4.1</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          120 cenários · 98% automação · 2 erros
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">Ver detalhes</Button>
      </CardFooter>
    </Card>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Total de Cenários</CardTitle>
        <CardDescription>Últimos 30 dias</CardDescription>
        <CardAction>
          <Badge variant="default">+12%</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-text-primary">1.284</p>
      </CardContent>
    </Card>
  ),
}

export const Small: Story = {
  render: () => (
    <Card size="sm" className="w-72">
      <CardHeader>
        <CardTitle>Erros detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-destructive">47</p>
      </CardContent>
    </Card>
  ),
}

export const MetricCards: Story = {
  name: "Metric Cards (Dashboard)",
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      {[
        { label: "Total de Cenários", value: "1.284", change: "+12%" },
        { label: "Automação", value: "87%", change: "+3%" },
        { label: "Execuções hoje", value: "342", change: "+8%" },
        { label: "Taxa de erro", value: "2.1%", change: "-0.4%" },
      ].map((m) => (
        <Card key={m.label} className="rounded-xl bg-surface-card p-5 shadow-card">
          <p className="text-sm text-text-secondary">{m.label}</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">{m.value}</p>
          <p className="mt-1 text-xs font-medium text-green-600">{m.change}</p>
        </Card>
      ))}
    </div>
  ),
}
