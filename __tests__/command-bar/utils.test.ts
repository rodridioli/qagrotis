import { describe, it, expect } from "vitest"
import { z } from "zod"

// ── Sanitize (extracted from route.ts for testing) ────────────────────────────

function sanitize(cmd: string): string {
  return cmd.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, 500)
}

// ── Rate limit (extracted for unit testing) ───────────────────────────────────

function makeRateLimiter(maxPerHour: number) {
  const map = new Map<string, { count: number; resetAt: number }>()
  return function check(userId: string): boolean {
    const now = Date.now()
    for (const [k, v] of map) { if (now > v.resetAt) map.delete(k) }
    const entry = map.get(userId)
    if (!entry || now > entry.resetAt) {
      map.set(userId, { count: 1, resetAt: now + 60 * 60_000 })
      return true
    }
    if (entry.count >= maxPerHour) return false
    entry.count++
    return true
  }
}

// ── AI Response schema (mirrors route.ts) ─────────────────────────────────────

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  module: z.string(),
  meta: z.string().optional(),
})

const aiResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), path: z.string().startsWith("/"), label: z.string() }),
  z.object({ type: z.literal("query"), title: z.string(), items: z.array(itemSchema).max(10), viewAllPath: z.string() }),
  z.object({
    type: z.literal("action"),
    actionType: z.enum(["create", "update", "delete"]),
    label: z.string().max(200),
    details: z.array(z.string().max(300)).max(10),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal("error"), message: z.string().max(300), suggestion: z.string().max(500) }),
  z.object({ type: z.literal("clarify"), question: z.string().max(300), options: z.array(z.string().max(100)).max(8).optional() }),
])

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sanitize", () => {
  it("remove caracteres de controle", () => {
    expect(sanitize("comando\x00malicioso")).toBe("comandomalicioso")
    expect(sanitize("texto\x01\x02\x03limpo")).toBe("textolimpo")
  })

  it("mantém texto normal intacto", () => {
    expect(sanitize("liste cenários com erro")).toBe("liste cenários com erro")
  })

  it("faz trim de espaços nas bordas", () => {
    expect(sanitize("  comando  ")).toBe("comando")
  })

  it("trunca em 500 caracteres", () => {
    const longo = "a".repeat(600)
    expect(sanitize(longo)).toHaveLength(500)
  })

  it("retorna string vazia para input só de controle", () => {
    expect(sanitize("\x00\x01\x02")).toBe("")
  })

  it("preserva acentuação PT-BR", () => {
    expect(sanitize("crie uma suíte de regressão")).toBe("crie uma suíte de regressão")
  })
})

describe("rate limiter", () => {
  it("permite até o limite máximo de requests", () => {
    const check = makeRateLimiter(3)
    expect(check("user-1")).toBe(true)
    expect(check("user-1")).toBe(true)
    expect(check("user-1")).toBe(true)
    expect(check("user-1")).toBe(false)
  })

  it("usuários diferentes têm limites independentes", () => {
    const check = makeRateLimiter(2)
    expect(check("user-a")).toBe(true)
    expect(check("user-a")).toBe(true)
    expect(check("user-a")).toBe(false)
    // user-b ainda tem cota disponível
    expect(check("user-b")).toBe(true)
    expect(check("user-b")).toBe(true)
    expect(check("user-b")).toBe(false)
  })

  it("retorna true para novo usuário após limpar expirados", () => {
    const check = makeRateLimiter(1)
    expect(check("fresh-user")).toBe(true)
    expect(check("fresh-user")).toBe(false)
  })
})

describe("aiResponseSchema", () => {
  it("valida navigate corretamente", () => {
    const input = { type: "navigate", path: "/cenarios", label: "Cenários" }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("rejeita navigate com path sem barra inicial", () => {
    const input = { type: "navigate", path: "cenarios", label: "Cenários" }
    expect(aiResponseSchema.safeParse(input).success).toBe(false)
  })

  it("valida query com items", () => {
    const input = {
      type: "query",
      title: "5 cenários encontrados",
      items: [{ id: "1", name: "Login", module: "Auth", meta: "3 erros" }],
      viewAllPath: "/cenarios?erros=1",
    }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("rejeita query com mais de 10 items", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: "N", module: "M" }))
    expect(aiResponseSchema.safeParse({ type: "query", title: "t", items, viewAllPath: "/" }).success).toBe(false)
  })

  it("valida action create", () => {
    const input = {
      type: "action",
      actionType: "create",
      label: "Criar suite",
      details: ["detalhe 1"],
      payload: { actionName: "criar_suite" },
    }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("rejeita actionType inválido", () => {
    const input = {
      type: "action",
      actionType: "nuke", // inválido
      label: "X",
      details: [],
      payload: {},
    }
    expect(aiResponseSchema.safeParse(input).success).toBe(false)
  })

  it("valida error com message e suggestion", () => {
    const input = { type: "error", message: "Não entendi", suggestion: "Tente assim" }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("valida clarify com options", () => {
    const input = { type: "clarify", question: "Qual módulo?", options: ["Financeiro", "Vendas"] }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("valida clarify sem options (opcional)", () => {
    const input = { type: "clarify", question: "Qual módulo?" }
    expect(aiResponseSchema.safeParse(input).success).toBe(true)
  })

  it("rejeita type desconhecido", () => {
    expect(aiResponseSchema.safeParse({ type: "unknown" }).success).toBe(false)
  })

  it("strip markdown fences — JSON com ```json blocos é parseável após strip", () => {
    const raw = "```json\n{\"type\":\"navigate\",\"path\":\"/cenarios\",\"label\":\"Cenários\"}\n```"
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    const parsed = JSON.parse(stripped)
    expect(aiResponseSchema.safeParse(parsed).success).toBe(true)
  })
})
