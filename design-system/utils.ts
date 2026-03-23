/**
 * Convert a dot-notated token key to a CSS custom property name.
 * e.g. "colors.primary" → "--color-primary"
 *      "radius.lg"       → "--radius-lg"
 */
export function tokenKeyToCssVar(key: string): string {
  const [group, ...rest] = key.split(".")
  const suffix = rest.join("-")

  const groupMap: Record<string, string> = {
    colors: "color",
    spacing: "spacing",
    typography: "font",
    radius: "radius",
  }

  const prefix = groupMap[group] ?? group
  return `--${prefix}-${suffix}`
}

/**
 * Convert a sidebar token key to a CSS custom property name.
 * e.g. "background" → "--sidebar-background"
 */
export function sidebarKeyToCssVar(key: string): string {
  return `--sidebar-${key}`
}
