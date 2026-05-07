import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import * as React from "react"
import { BookOpen } from "lucide-react"
import { PerformanceEvaluationSectionGrid } from "@/components/individual/PerformanceEvaluationSectionGrid"
import { PERFORMANCE_EVALUATION_SECTIONS } from "@/lib/individual-performance-evaluation"

const section = PERFORMANCE_EVALUATION_SECTIONS[0]!

function Stateful() {
  const [selections, setSelections] = React.useState<Record<string, number | undefined>>({})
  return (
    <PerformanceEvaluationSectionGrid
      section={section}
      selections={selections}
      onSelectLevel={(id, level) => setSelections((s) => ({ ...s, [id]: level }))}
      icon={<BookOpen className="size-5" aria-hidden />}
    />
  )
}

const meta: Meta<typeof PerformanceEvaluationSectionGrid> = {
  title: "Individual/PerformanceEvaluationSectionGrid",
  component: PerformanceEvaluationSectionGrid,
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof PerformanceEvaluationSectionGrid>

export const Conhecimentos: Story = {
  render: () => <Stateful />,
}
