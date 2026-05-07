/**
 * Design System CSS Generator
 *
 * Generates CSS custom properties from tokens.ts into app/globals.css
 *
 * Usage:
 *   npx tsx design-system/generate-css.ts           # Generate / update
 *   npx tsx design-system/generate-css.ts --check   # Validate (exit 1 if outdated)
 */

import fs from "fs"
import path from "path"
import { tokens } from "./tokens"

const GLOBALS_CSS_PATH = path.resolve(__dirname, "../app/globals.css")

// ──────────────────────────────────────────────
// Flatten tokens into { cssVar: value } pairs
// ──────────────────────────────────────────────
function flattenColors(
  obj: Record<string, unknown>,
  prefix = "--color"
): Array<[string, string]> {
  const result: Array<[string, string]> = []

  for (const [key, value] of Object.entries(obj)) {
    if (key === "primitive") {
      // Flatten primitive colors with their full path
      for (const [colorName, shades] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (typeof shades === "object" && shades !== null) {
          for (const [shade, hsl] of Object.entries(
            shades as Record<string, string>
          )) {
            result.push([`${prefix}-${colorName}-${shade}`, hsl])
          }
        } else {
          result.push([`${prefix}-${colorName}`, shades as string])
        }
      }
    } else if (typeof value === "string") {
      result.push([`${prefix}-${key}`, value])
    }
  }

  return result
}

function flattenSidebar(
  sidebar: Record<string, string>
): Array<[string, string]> {
  return Object.entries(sidebar).map(([key, value]) => [
    `--sidebar-${key}`,
    value,
  ])
}

function flattenRadius(
  radius: Record<string, string>
): Array<[string, string]> {
  return Object.entries(radius).map(([key, value]) => [
    `--radius-${key}`,
    value,
  ])
}

function buildRootBlock(): string {
  const lines: string[] = []

  // Colors (semantic)
  const colorPairs = flattenColors(tokens.colors as Record<string, unknown>)
  lines.push("  /* ── Colors ── */")
  for (const [cssVar, value] of colorPairs) {
    lines.push(`  ${cssVar}: ${value};`)
  }

  lines.push("")

  // Sidebar tokens
  lines.push("  /* ── Sidebar ── */")
  for (const [cssVar, value] of flattenSidebar(tokens.sidebar)) {
    lines.push(`  ${cssVar}: ${value};`)
  }

  lines.push("")

  // Radius
  lines.push("  /* ── Radius ── */")
  for (const [cssVar, value] of flattenRadius(tokens.radius)) {
    lines.push(`  ${cssVar}: ${value};`)
  }

  return `:root {\n${lines.join("\n")}\n}`
}

// ──────────────────────────────────────────────
// Read / write globals.css
// ──────────────────────────────────────────────
const ROOT_START = "/* [design-system:start] */"
const ROOT_END = "/* [design-system:end] */"

function injectIntoGlobals(current: string, rootBlock: string): string {
  const generated = `${ROOT_START}\n${rootBlock}\n${ROOT_END}`

  if (current.includes(ROOT_START)) {
    // Replace existing block
    const regex = new RegExp(
      `${ROOT_START}[\\s\\S]*?${ROOT_END}`,
      "g"
    )
    return current.replace(regex, generated)
  }

  // Append before first non-@import line or at the end
  return `${current}\n\n${generated}\n`
}

function main() {
  const isCheck = process.argv.includes("--check")

  if (!fs.existsSync(GLOBALS_CSS_PATH)) {
    console.error(`globals.css not found at ${GLOBALS_CSS_PATH}`)
    process.exit(1)
  }

  const current = fs.readFileSync(GLOBALS_CSS_PATH, "utf-8")
  const rootBlock = buildRootBlock()
  const next = injectIntoGlobals(current, rootBlock)

  if (isCheck) {
    if (current !== next) {
      console.error(
        "❌ Design tokens are out of sync. Run `npm run tokens` to regenerate."
      )
      process.exit(1)
    }
    console.log("✅ Design tokens are up to date.")
    process.exit(0)
  }

  if (current === next) {
    console.log("✅ globals.css is already up to date. No changes needed.")
    return
  }

  fs.writeFileSync(GLOBALS_CSS_PATH, next, "utf-8")
  console.log("✅ globals.css updated with latest design tokens.")
}

main()
