import type { Preview } from "@storybook/nextjs-vite"

// Import globals.css so design tokens are available in all stories
import "../app/globals.css"

// Design tokens are available via CSS variables from globals.css
// Import tokens for use in stories if needed
// import { tokens } from "../design-system/tokens"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "hsl(0 0% 100%)" },
        { name: "dark", value: "hsl(0 0% 9%)" },
        { name: "gray", value: "hsl(0 0% 96%)" },
      ],
    },
  },
}

export default preview
