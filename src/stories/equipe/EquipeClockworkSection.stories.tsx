import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import {
  DayGroup,
  type DayGroupProps,
} from "@/features/equipe/components/EquipeClockworkSection"

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockEditMap = new Map([
  [
    "123456",
    {
      startHHmm: "09:00",
      endHHmm: "10:30",
      comment: "Desenvolvimento da feature de clockwork",
      saving: false,
      saveError: null,
    },
  ],
  [
    "123457",
    {
      startHHmm: "14:00",
      endHHmm: "16:00",
      comment: "Code review e ajustes",
      saving: false,
      saveError: null,
    },
  ],
  [
    "123458",
    {
      startHHmm: "16:30",
      endHHmm: "17:00",
      comment: "",
      saving: false,
      saveError: null,
    },
  ],
])

const mockDay: DayGroupProps["day"] = {
  dateKey: "2026-05-28",
  label: "Quinta-feira, 28 de maio de 2026",
  worklogs: [
    {
      id: "123456",
      issueKey: "QA-1234",
      summary: "Implementar tela de Clockwork no Equipe",
      started: "2026-05-28T12:00:00.000Z",
      timeSpentSeconds: 5400,
      comment: "Desenvolvimento da feature de clockwork",
    },
    {
      id: "123457",
      issueKey: "QA-1235",
      summary: "Revisão de PRs pendentes",
      started: "2026-05-28T17:00:00.000Z",
      timeSpentSeconds: 7200,
      comment: "Code review e ajustes",
    },
    {
      id: "123458",
      issueKey: "QA-1236",
      summary: "Atualização de documentação",
      started: "2026-05-28T19:30:00.000Z",
      timeSpentSeconds: 1800,
      comment: "",
    },
  ],
  totalSeconds: 5400 + 7200 + 1800,
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title: "Equipe/EquipeClockworkSection",
  component: DayGroup,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DayGroup>

export default meta
type Story = StoryObj<typeof meta>

// ── Stories ───────────────────────────────────────────────────────────────────

export const Expandido: Story = {
  name: "Dia expandido",
  args: {
    day: mockDay,
    editMap: mockEditMap,
    collapsed: false,
    onToggle: () => {},
    onFieldChange: () => {},
    onBlurSave: () => {},
  },
  render: (args) => (
    <div className="max-w-4xl">
      <DayGroup {...args} />
    </div>
  ),
}

export const Contraido: Story = {
  name: "Dia contraído",
  args: {
    day: mockDay,
    editMap: mockEditMap,
    collapsed: true,
    onToggle: () => {},
    onFieldChange: () => {},
    onBlurSave: () => {},
  },
  render: (args) => (
    <div className="max-w-4xl">
      <DayGroup {...args} />
    </div>
  ),
}

export const ComErro: Story = {
  name: "Com erro de validação",
  args: {
    day: {
      ...mockDay,
      worklogs: [mockDay.worklogs[2]!],
      totalSeconds: 1800,
    },
    editMap: new Map([
      [
        "123458",
        {
          startHHmm: "17:00",
          endHHmm: "16:00",
          comment: "",
          saving: false,
          saveError: "Horário inválido: fim deve ser após o início.",
        },
      ],
    ]),
    collapsed: false,
    onToggle: () => {},
    onFieldChange: () => {},
    onBlurSave: () => {},
  },
  render: (args) => (
    <div className="max-w-4xl">
      <DayGroup {...args} />
    </div>
  ),
}

export const Salvando: Story = {
  name: "Salvando (loading state)",
  args: {
    day: {
      ...mockDay,
      worklogs: [mockDay.worklogs[0]!],
      totalSeconds: 5400,
    },
    editMap: new Map([
      [
        "123456",
        {
          startHHmm: "09:00",
          endHHmm: "10:30",
          comment: "Desenvolvimento da feature de clockwork",
          saving: true,
          saveError: null,
        },
      ],
    ]),
    collapsed: false,
    onToggle: () => {},
    onFieldChange: () => {},
    onBlurSave: () => {},
  },
  render: (args) => (
    <div className="max-w-4xl">
      <DayGroup {...args} />
    </div>
  ),
}
