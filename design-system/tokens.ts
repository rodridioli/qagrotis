export type DesignTokens = {
  colors: {
    // Primitives
    primitive: {
      white: string
      black: string
      neutral: Record<string, string>
      blue: Record<string, string>
      green: Record<string, string>
      red: Record<string, string>
      yellow: Record<string, string>
      purple: Record<string, string>
    }
    // Semantic
    background: string
    foreground: string
    card: string
    "card-foreground": string
    popover: string
    "popover-foreground": string
    primary: string
    "primary-foreground": string
    secondary: string
    "secondary-foreground": string
    muted: string
    "muted-foreground": string
    accent: string
    "accent-foreground": string
    destructive: string
    "destructive-foreground": string
    border: string
    input: string
    ring: string
  }
  sidebar: {
    background: string
    foreground: string
    primary: string
    "primary-foreground": string
    accent: string
    "accent-foreground": string
    border: string
    ring: string
  }
  spacing: {
    "0": string
    "1": string
    "2": string
    "3": string
    "4": string
    "5": string
    "6": string
    "8": string
    "10": string
    "12": string
    "16": string
    "20": string
    "24": string
    "32": string
    "40": string
    "48": string
    "64": string
  }
  typography: {
    fontFamily: {
      sans: string
      mono: string
    }
    fontSize: {
      xs: string
      sm: string
      base: string
      lg: string
      xl: string
      "2xl": string
      "3xl": string
      "4xl": string
    }
    fontWeight: {
      normal: string
      medium: string
      semibold: string
      bold: string
    }
    lineHeight: {
      tight: string
      normal: string
      relaxed: string
    }
  }
  radius: {
    none: string
    /** Raio base da UI (~8px em 16px); escala com font-size */
    control: string
    sm: string
    md: string
    lg: string
    xl: string
    full: string
  }
}

export const tokens: DesignTokens = {
  colors: {
    primitive: {
      white: "0 0% 100%",
      black: "0 0% 0%",
      neutral: {
        "50": "0 0% 98%",
        "100": "0 0% 96%",
        "200": "0 0% 90%",
        "300": "0 0% 83%",
        "400": "0 0% 64%",
        "500": "0 0% 45%",
        "600": "0 0% 32%",
        "700": "0 0% 25%",
        "800": "0 0% 15%",
        "900": "0 0% 9%",
        "950": "0 0% 4%",
      },
      blue: {
        "50": "214 100% 97%",
        "100": "214 95% 93%",
        "200": "213 97% 87%",
        "300": "212 96% 78%",
        "400": "213 94% 68%",
        "500": "217 91% 60%",
        "600": "221 83% 53%",
        "700": "224 76% 48%",
        "800": "226 71% 40%",
        "900": "224 64% 33%",
        "950": "226 57% 21%",
      },
      green: {
        "50": "138 76% 97%",
        "100": "141 84% 93%",
        "200": "141 79% 85%",
        "300": "142 77% 73%",
        "400": "142 69% 58%",
        "500": "142 71% 45%",
        "600": "142 76% 36%",
        "700": "142 72% 29%",
        "800": "143 64% 24%",
        "900": "144 61% 20%",
        "950": "145 80% 10%",
      },
      red: {
        "50": "0 86% 97%",
        "100": "0 93% 94%",
        "200": "0 96% 89%",
        "300": "0 94% 82%",
        "400": "0 91% 71%",
        "500": "0 84% 60%",
        "600": "0 72% 51%",
        "700": "0 74% 42%",
        "800": "0 70% 35%",
        "900": "0 63% 31%",
        "950": "0 75% 15%",
      },
      yellow: {
        "50": "55 92% 95%",
        "100": "55 97% 88%",
        "200": "53 98% 77%",
        "300": "50 98% 64%",
        "400": "48 96% 53%",
        "500": "45 93% 47%",
        "600": "41 96% 40%",
        "700": "35 92% 33%",
        "800": "32 81% 29%",
        "900": "28 73% 26%",
        "950": "26 83% 14%",
      },
      purple: {
        "50": "270 100% 98%",
        "100": "269 100% 95%",
        "200": "269 100% 92%",
        "300": "269 97% 85%",
        "400": "270 95% 75%",
        "500": "271 91% 65%",
        "600": "271 81% 56%",
        "700": "272 72% 47%",
        "800": "272 67% 39%",
        "900": "273 66% 32%",
        "950": "274 75% 20%",
      },
    },
    // Semantic (light mode — mapped to neutral/blue primitives via oklch-equivalent HSL)
    background: "0 0% 100%",
    foreground: "0 0% 9%",
    card: "0 0% 100%",
    "card-foreground": "0 0% 9%",
    popover: "0 0% 100%",
    "popover-foreground": "0 0% 9%",
    primary: "221 83% 53%",
    "primary-foreground": "0 0% 100%",
    secondary: "0 0% 96%",
    "secondary-foreground": "0 0% 9%",
    muted: "0 0% 96%",
    "muted-foreground": "0 0% 45%",
    accent: "0 0% 96%",
    "accent-foreground": "0 0% 9%",
    destructive: "0 84% 60%",
    "destructive-foreground": "0 0% 100%",
    border: "0 0% 90%",
    input: "0 0% 90%",
    ring: "221 83% 53%",
  },
  sidebar: {
    background: "0 0% 98%",
    foreground: "0 0% 25%",
    primary: "221 83% 53%",
    "primary-foreground": "0 0% 100%",
    accent: "0 0% 96%",
    "accent-foreground": "0 0% 9%",
    border: "0 0% 90%",
    ring: "221 83% 53%",
  },
  // 8px grid-based spacing
  spacing: {
    "0": "0px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
    "32": "128px",
    "40": "160px",
    "48": "192px",
    "64": "256px",
  },
  typography: {
    fontFamily: {
      sans: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
      mono: "var(--font-geist-mono), ui-monospace, monospace",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.75",
    },
  },
  radius: {
    none: "0px",
    control: "0.5em",
    sm: "var(--radius-control)",
    md: "var(--radius-control)",
    lg: "var(--radius-control)",
    xl: "var(--radius-control)",
    full: "9999px",
  },
}

export default tokens

// ─────────────────────────────────────────────────────────────
// QAgrotis Design Tokens — single source of truth
// All values below are consumed by app/globals.css via @theme
// ─────────────────────────────────────────────────────────────
export const qagrotisTokens = {
  /** Primitive palette */
  colors: {
    primitives: {
      blue: "#5c7cfa",
    },
    /** Semantic tokens — refer to primitives or raw hex */
    semantic: {
      brandPrimary: "var(--primitive-blue)",
      surfaceDefault: "#f4f5f9",
      surfaceCard: "#ffffff",
      surfaceInput: "#f8f9fc",
      textPrimary: "#333333",
      textSecondary: "#6b7280",
      borderDefault: "#e5e7eb",
    },
    /**
     * Brand primary scale — 10 shades built around #5c7cfa (hue 228°).
     * Use bg-primary-500 / text-primary-900 etc. as Tailwind utilities.
     */
    primary: {
      "50":  "#eef2ff",
      "100": "#e0e9ff",
      "200": "#c7d5ff",
      "300": "#a4bcfd",
      "400": "#819bfb",
      "500": "#5c7cfa", // ← brand-primary / primitive-blue
      "600": "#4360e8",
      "700": "#3549c5",
      "800": "#2c3a99",
      "900": "#1e2a6e",
    },
    /**
     * Secondary scale — cool slate, 10 shades.
     * Use bg-secondary-500 / text-secondary-700 etc.
     */
    secondary: {
      "50":  "#f8fafc",
      "100": "#f1f5f9",
      "200": "#e2e8f0",
      "300": "#cbd5e1",
      "400": "#94a3b8",
      "500": "#64748b",
      "600": "#475569",
      "700": "#334155",
      "800": "#1e293b",
      "900": "#0f172a",
    },
    /** Cold neutral-grey scale (Tailwind cool-gray compatible) */
    neutralGrey: {
      "50": "#f9fafb",
      "100": "#f3f4f6",
      "200": "#e5e7eb",
      "300": "#d1d5db",
      "400": "#9ca3af",
      "500": "#6b7280",
      "600": "#4b5563",
      "700": "#374151",
      "800": "#1f2937",
      "900": "#111827",
    },
  },

  /** Typography — Roboto, base-8 scale */
  typography: {
    fontFamily: {
      roboto: "var(--font-roboto), ui-sans-serif, system-ui, sans-serif",
    },
    fontSize: {
      sm: "14px",   // text-sm
      base: "16px", // text-base
      lg: "18px",   // text-lg
      xl: "20px",   // text-xl
      "2xl": "24px",// text-2xl
    },
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeight: {
      default: "1.5",
    },
  },

  /** Spacing — base-8px grid */
  spacing: {
    "1": "8px",  // spacing-1
    "2": "16px", // spacing-2
    "3": "24px", // spacing-3
    "4": "32px", // spacing-4
  },

  /** Border radius — alinhado a tokens.radius.control / rounded-custom (~8px em 16px) */
  radius: {
    default: "0.5em",
  },

  /** Shadows */
  shadows: {
    /** Soft card shadow — maps to shadow-card utility */
    card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
  },
} as const
