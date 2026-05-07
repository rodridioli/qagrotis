import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Trophy, MonitorPlay, ThumbsUp, GraduationCap } from "lucide-react"
import { BadgeAchievement } from "@/features/individual/components/BadgeAchievement"

const meta = {
  title: "Individual/BadgeAchievement",
  component: BadgeAchievement,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof BadgeAchievement>

export default meta
type Story = StoryObj<typeof meta>

export const TempoDesbloqueado: Story = {
  args: {
    label: "1 Ano",
    icon: Trophy,
    color: "var(--qagrotis-primary-500)",
    unlocked: true,
  },
}

export const TempoBloqueado: Story = {
  args: {
    label: "5 Anos",
    icon: Trophy,
    color: "var(--qagrotis-primary-500)",
    unlocked: false,
  },
}

export const ChapterDesbloqueado: Story = {
  args: {
    label: "5 Chapters",
    icon: MonitorPlay,
    color: "var(--badge-info)",
    unlocked: true,
  },
}

export const FeedbackDesbloqueado: Story = {
  args: {
    label: "1 Feedback",
    icon: ThumbsUp,
    color: "var(--badge-orange)",
    unlocked: true,
  },
}

export const FormacaoDesbloqueado: Story = {
  args: {
    label: "Mestrado",
    icon: GraduationCap,
    color: "var(--badge-warning)",
    unlocked: true,
  },
}

export const FormacaoBloqueado: Story = {
  args: {
    label: "Doutorado",
    icon: GraduationCap,
    color: "var(--badge-warning)",
    unlocked: false,
  },
}

export const ComDescricao: Story = {
  args: {
    label: "10 Anos",
    icon: Trophy,
    color: "var(--qagrotis-primary-500)",
    unlocked: true,
    description: "Conquistado por 10 anos de empresa",
  },
}

export const TodasAsTrilhas: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-6 p-4">
      <BadgeAchievement label="6 Meses"       icon={Trophy}       color="var(--qagrotis-primary-500)" unlocked={true}  />
      <BadgeAchievement label="1 Ano"          icon={Trophy}       color="var(--qagrotis-primary-500)" unlocked={true}  />
      <BadgeAchievement label="5 Anos"         icon={Trophy}       color="var(--qagrotis-primary-500)" unlocked={false} />
      <BadgeAchievement label="10 Anos"        icon={Trophy}       color="var(--qagrotis-primary-500)" unlocked={false} />
      <BadgeAchievement label="1 Chapter"      icon={MonitorPlay}  color="var(--badge-info)"           unlocked={true}  />
      <BadgeAchievement label="5 Chapters"     icon={MonitorPlay}  color="var(--badge-info)"           unlocked={false} />
      <BadgeAchievement label="1 Feedback"     icon={ThumbsUp}     color="var(--badge-orange)"         unlocked={true}  />
      <BadgeAchievement label="5 Feedbacks"    icon={ThumbsUp}     color="var(--badge-orange)"         unlocked={false} />
      <BadgeAchievement label="Pós-graduação"  icon={GraduationCap} color="var(--badge-warning)"       unlocked={true}  />
      <BadgeAchievement label="Doutorado"      icon={GraduationCap} color="var(--badge-warning)"       unlocked={false} />
    </div>
  ),
}
