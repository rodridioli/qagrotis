import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DominioAvaliacaoModal } from "./DominioAvaliacaoModal"

const mockOnSubmit = () => Promise.resolve({})

const mockProdutos = [
  {
    id: "prod-1",
    nome: "Agrotis Plataforma Agro",
    modulos: [
      { id: "mod-1", nome: "Core / ACC" },
      { id: "mod-2", nome: "REC - Receituário" },
      { id: "mod-3", nome: "CDP - Controle de Pátio" },
    ],
  },
  {
    id: "prod-2",
    nome: "Módulo de Sementes",
    modulos: [
      { id: "mod-4", nome: "SEM - Campos de Sementes" },
      { id: "mod-5", nome: "LAS - Laboratório de Sementes" },
      { id: "mod-6", nome: "BEN - Beneficiamento" },
      { id: "mod-7", nome: "CSEM - Comercial Sementes" },
    ],
  },
  {
    id: "prod-3",
    nome: "Módulo Financeiro",
    modulos: [
      { id: "mod-8", nome: "ARM - Armazenagem" },
      { id: "mod-9", nome: "FIN - Contas a Pagar" },
    ],
  },
]

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
          "Drawer lateral de avaliação de domínio. Guia o usuário step a step por produto, com indicador de progresso, revisão e tela de conclusão. Obrigatório — não pode ser fechado antes de completar.",
      },
    },
  },
  args: {
    onSubmit: mockOnSubmit,
  },
}

export default meta
type Story = StoryObj<typeof DominioAvaliacaoModal>

export const Default: Story = {
  name: "Agrotis — 3 produtos",
  args: {
    avaliacaoId: "avaliacao-mock-123",
    configSnapshot: mockProdutos,
  },
}

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

export const SemProdutos: Story = {
  name: "Sem produtos configurados",
  args: {
    avaliacaoId: "avaliacao-demo-3",
    configSnapshot: [],
  },
}
