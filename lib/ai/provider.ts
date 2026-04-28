export type CanonicalProvider = "google" | "openrouter" | "openai" | "anthropic" | "groq"

const ALIAS_MAP: Record<string, CanonicalProvider> = {
  google: "google",
  gemini: "google",
  "google gemini": "google",
  "google ai": "google",
  "google ai studio": "google",
  "openrouter": "openrouter",
  "open router": "openrouter",
  openai: "openai",
  "open ai": "openai",
  gpt: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  groq: "groq",
  llama: "groq",
  mistral: "groq",
}

function compactProvider(raw: string): string {
  return raw.toLowerCase().trim().replace(/[_-]/g, " ").replace(/\s+/g, " ")
}

export function normalizeProvider(rawProvider?: string | null): CanonicalProvider | null {
  if (!rawProvider) return null

  const compact = compactProvider(rawProvider)
  if (!compact) return null

  const direct = ALIAS_MAP[compact]
  if (direct) return direct

  if (compact.includes("openrouter") || compact.includes("open router")) return "openrouter"
  if (compact.includes("anthropic") || compact.includes("claude")) return "anthropic"
  if (compact.includes("openai") || compact.includes("open ai") || compact.includes("gpt")) return "openai"
  if (compact.includes("groq") || compact.includes("llama") || compact.includes("mistral")) return "groq"
  if (compact.includes("gemini") || compact.includes("google")) return "google"

  return null
}
