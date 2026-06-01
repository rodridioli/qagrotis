import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock("@/core/session", () => ({
  requireSession: vi.fn(),
}))

vi.mock("@/core/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  },
}))

vi.mock("@/core/prisma-schema-ensure", () => ({
  ensureIndividualProgressaoTable: vi.fn().mockResolvedValue(undefined),
  ensureIndividualProgressaoCargoColumn: vi.fn().mockResolvedValue(undefined),
  ensureIndividualProgressaoValorHoraColumn: vi.fn().mockResolvedValue(undefined),
  ensureUserClassificacaoColumns: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/core/actions/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}))

import { requireSession } from "@/core/session"
import { prisma } from "@/core/prisma"
import {
  listProgressoes,
  listMinhasProgressoes,
  createProgressao,
  updateProgressao,
  deleteProgressao,
  getValorHoraAtualBatch,
  getProgressaoHistoricoBatch,
} from "@/features/individual/actions/individual-progressao"
import { buildRole, can } from "@/core/rbac/policy"

// ── Fixtures ───────────────────────────────────────────────────────────────────

function fakeSession(type: string, accessProfile: string, id = "uid-session") {
  return {
    user: { id, type, accessProfile, name: "Test User", email: "test@test.com" },
  } as ReturnType<typeof requireSession> extends Promise<infer S> ? S : never
}

/** Todos os roles que NÃO devem ter acesso a dados de progressão de terceiros. */
const NON_MGR_ROLES: [string, string][] = [
  ["Padrão",        "QA"],
  ["Padrão",        "UX"],
  ["Padrão",        "TW"],
  ["Administrador", "QA"],
  ["Administrador", "UX"],
  ["Administrador", "TW"],
  ["Padrão",        "MGR"], // combinação inválida — fallback fechado
]

const SAMPLE_CREATE_INPUT = {
  evaluatedUserId: "uid-evaluated",
  data: "2025-01-15",
  tipo: "ADMISSAO" as const,
  regime: "CLT" as const,
  cargo: "Analista de QA",
  valorHora: null,
  valor: 500_000,
}

const SAMPLE_UPDATE_INPUT = {
  ...SAMPLE_CREATE_INPUT,
  id: "prog-id-1",
}

// ── 1. RBAC Policy — testes puros, sem dependência de I/O ─────────────────────

describe("RBAC — individual.viewOthers", () => {
  it("Administrador:MGR tem a capability individual.viewOthers", () => {
    expect(can("Administrador:MGR", "individual.viewOthers")).toBe(true)
  })

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' NÃO tem individual.viewOthers",
    (type, profile) => {
      const role = buildRole(type, profile)
      expect(can(role, "individual.viewOthers")).toBe(false)
    },
  )
})

// ── 2. listProgressoes — roles não-MGR devem ser bloqueados ───────────────────

describe("listProgressoes — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → lança 'Sem permissão.'",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      await expect(listProgressoes("uid-any")).rejects.toThrow("Sem permissão.")
    },
  )

  it("Administrador:MGR → não lança erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    await expect(listProgressoes("uid-any")).resolves.toEqual([])
  })
})

// ── 3. createProgressao — roles não-MGR recebem { error } ────────────────────

describe("createProgressao — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → retorna { error: 'Sem permissão.' }",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      const res = await createProgressao(SAMPLE_CREATE_INPUT)
      expect(res.error).toBe("Sem permissão.")
    },
  )

  it("Administrador:MGR → não retorna erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ codigo: 0 }])
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    const res = await createProgressao(SAMPLE_CREATE_INPUT)
    expect(res.error).not.toBe("Sem permissão.")
  })
})

// ── 4. updateProgressao — roles não-MGR recebem { error } ────────────────────

describe("updateProgressao — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → retorna { error: 'Sem permissão.' }",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      const res = await updateProgressao(SAMPLE_UPDATE_INPUT)
      expect(res.error).toBe("Sem permissão.")
    },
  )

  it("Administrador:MGR → não retorna erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ evaluatedUserId: "uid-eval", id: "prog-id-1" }])
    const res = await updateProgressao(SAMPLE_UPDATE_INPUT)
    expect(res.error).not.toBe("Sem permissão.")
  })
})

// ── 5. deleteProgressao — roles não-MGR recebem { error } ────────────────────

describe("deleteProgressao — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → retorna { error: 'Sem permissão.' }",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      const res = await deleteProgressao("prog-id-1")
      expect(res.error).toBe("Sem permissão.")
    },
  )

  it("Administrador:MGR → não retorna erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1)
    const res = await deleteProgressao("prog-id-1")
    expect(res.error).not.toBe("Sem permissão.")
  })
})

// ── 6. getValorHoraAtualBatch — roles não-MGR devem ser bloqueados ────────────

describe("getValorHoraAtualBatch — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → lança 'Sem permissão.'",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      await expect(getValorHoraAtualBatch(["uid-any"])).rejects.toThrow("Sem permissão.")
    },
  )

  it("Administrador:MGR → resolve sem erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    await expect(getValorHoraAtualBatch(["uid-any"])).resolves.toBeDefined()
  })
})

// ── 7. getProgressaoHistoricoBatch — roles não-MGR devem ser bloqueados ───────

describe("getProgressaoHistoricoBatch — controle de acesso", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(NON_MGR_ROLES)(
    "Tipo='%s' Perfil='%s' → lança 'Sem permissão.'",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      await expect(getProgressaoHistoricoBatch(["uid-any"])).rejects.toThrow("Sem permissão.")
    },
  )

  it("Administrador:MGR → resolve sem erro de permissão", async () => {
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Administrador", "MGR"))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    await expect(getProgressaoHistoricoBatch(["uid-any"])).resolves.toBeDefined()
  })
})

// ── 8. listMinhasProgressoes — acessível a qualquer autenticado ───────────────

describe("listMinhasProgressoes — isolamento de dados", () => {
  beforeEach(() => vi.clearAllMocks())

  const ALL_ROLES: [string, string][] = [
    ...NON_MGR_ROLES,
    ["Administrador", "MGR"],
  ]

  it.each(ALL_ROLES)(
    "Tipo='%s' Perfil='%s' → resolve sem erro (acessa apenas dados próprios)",
    async (type, profile) => {
      vi.mocked(requireSession).mockResolvedValue(fakeSession(type, profile))
      vi.mocked(prisma.$queryRaw).mockResolvedValue([])
      await expect(listMinhasProgressoes()).resolves.toEqual([])
    },
  )

  it("usa session.user.id como filtro, não aceita parâmetro externo", async () => {
    const ownId = "uid-proprio-xyz"
    vi.mocked(requireSession).mockResolvedValue(fakeSession("Padrão", "QA", ownId))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])

    await listMinhasProgressoes()

    // Tagged template: $queryRaw`...WHERE "evaluatedUserId" = ${ownId}...`
    // O segundo argumento do call é o valor interpolado (ownId).
    const calls = vi.mocked(prisma.$queryRaw).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const interpolatedValues = calls[0]!.slice(1)
    expect(interpolatedValues).toContain(ownId)
  })
})
