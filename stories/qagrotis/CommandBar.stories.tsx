import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "@storybook/test"
import { CommandBarSuggestions } from "@/components/qagrotis/CommandBarSuggestions"
import { CommandBarResult } from "@/components/qagrotis/CommandBarResult"
import { CommandBarConfirm } from "@/components/qagrotis/CommandBarConfirm"

// ── CommandBarSuggestions ─────────────────────────────────────────────────────

const metaSuggestions: Meta<typeof CommandBarSuggestions> = {
  title: "QAgrotis/CommandBar/Suggestions",
  component: CommandBarSuggestions,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[560px] overflow-hidden rounded-lg border border-border-default bg-surface-card">
        <Story />
      </div>
    ),
  ],
}

export default metaSuggestions
type SuggestionsStory = StoryObj<typeof CommandBarSuggestions>

export const Cenarios: SuggestionsStory = {
  args: { pathname: "/cenarios", onSelect: fn() },
}

export const Suites: SuggestionsStory = {
  args: { pathname: "/suites", onSelect: fn() },
}

export const Gerador: SuggestionsStory = {
  args: { pathname: "/gerador", onSelect: fn() },
}

export const Equipe: SuggestionsStory = {
  args: { pathname: "/equipe", onSelect: fn() },
}

export const Default: SuggestionsStory = {
  args: { pathname: "/", onSelect: fn() },
}
