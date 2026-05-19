import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DominioAvaliacaoModal } from "./DominioAvaliacaoModal"

const mockOnSubmit = () => Promise.resolve({})

const meta: Meta<typeof DominioAvaliacaoModal> = {
  title: "Individual/DominioAvaliacaoModal",
  component: DominioAvaliacaoModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          "Wizard de avaliação de domínio em tela cheia. Guia o usuário step a step por produto, com barra de progresso, tela de revisão e tela de conclusão. Obrigatório — não pode ser fechado antes de completar.",
      },
    },
  },
  args: {
    onSubmit: mockOnSubmit,
  },
}

export default meta
type Story = StoryObj<typeof DominioAvaliacaoModal>

// ── 1 produto, 1 módulo ───────────────────────────────────────

export const UmProdutoUmModulo: Story = {
  name: "1 produto · 1 módulo",
  args: {
    avaliacaoId: "avaliacao-demo-1",
    configSnapshot: [
      {
        id: "p1",
        nome: "Front-end",
        modulos: [{ id: "m1", nome: "React" }],
      },
    ],
  },
}

// ── 3 produtos, 2–4 módulos cada ─────────────────────────────

export const TresProdutosVariosModulos: Story = {
  name: "3 produtos · 2–4 módulos",
  args: {
    avaliacaoId: "avaliacao-demo-2",
    configSnapshot: [
      {
        id: "p1",
        nome: "Front-end",
        modulos: [
          { id: "m1", nome: "React" },
          { id: "m2", nome: "TypeScript" },
          { id: "m3", nome: "CSS / Tailwind" },
          { id: "m4", nome: "Testes (Vitest)" },
        ],
      },
      {
        id: "p2",
        nome: "Back-end",
        modulos: [
          { id: "m5", nome: "Node.js / Next.js API" },
          { id: "m6", nome: "Prisma ORM" },
          { id: "m7", nome: "Autenticação (Auth.js)" },
        ],
      },
      {
        id: "p3",
        nome: "Banco de Dados",
        modulos: [
          { id: "m8", nome: "PostgreSQL" },
          { id: "m9", nome: "SQL Avançado" },
        ],
      },
    ],
  },
}

// ── Sem produtos configurados ─────────────────────────────────

export const SemProdutos: Story = {
  name: "Sem produtos configurados",
  args: {
    avaliacaoId: "avaliacao-demo-3",
    configSnapshot: [],
  },
}
