import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { hashPassword, verifyPassword, encryptField, decryptField, nextId } from "./db-utils"

describe("hashPassword / verifyPassword", () => {
  it("roundtrip: verifica senha correta", () => {
    const hash = hashPassword("minha-senha-segura")
    expect(verifyPassword("minha-senha-segura", hash)).toBe(true)
  })

  it("rejeita senha errada", () => {
    const hash = hashPassword("correta")
    expect(verifyPassword("errada", hash)).toBe(false)
  })

  it("rejeita string vazia como stored", () => {
    expect(verifyPassword("qualquer", "")).toBe(false)
  })

  it("aceita legacy plaintext com timing-safe equal", () => {
    expect(verifyPassword("abc", "abc")).toBe(true)
    expect(verifyPassword("abc", "xyz")).toBe(false)
  })

  it("rejeita hash pbkdf2 malformado", () => {
    expect(verifyPassword("x", "pbkdf2:only-two-parts")).toBe(false)
  })

  it("rejeita iterações inválidas", () => {
    expect(verifyPassword("x", "pbkdf2:NaN:salt:hash")).toBe(false)
  })
})

describe("encryptField / decryptField", () => {
  const VALID_KEY = "a".repeat(64)

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.env as any).NODE_ENV = "test"
    process.env.ENCRYPTION_KEY = VALID_KEY
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY
  })

  it("roundtrip: encrypta e decripta o mesmo valor", () => {
    const cipher = encryptField("segredo-teste")
    expect(cipher).toMatch(/^enc:v1:/)
    expect(decryptField(cipher)).toBe("segredo-teste")
  })

  it("cada chamada gera IVs distintos (sem repetição)", () => {
    const a = encryptField("x")
    const b = encryptField("x")
    expect(a).not.toBe(b)
  })

  it("decryptField retorna plaintext diretamente se não começar com enc:v1:", () => {
    expect(decryptField("texto-puro")).toBe("texto-puro")
  })

  it("sem ENCRYPTION_KEY: encryptField apenas warn e retorna plaintext, nunca lança", () => {
    delete process.env.ENCRYPTION_KEY
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(() => encryptField("x")).not.toThrow()
    expect(encryptField("x")).toBe("x")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ENCRYPTION_KEY"))
    warnSpy.mockRestore()
  })
})

describe("nextId", () => {
  it("array vazio retorna primeiro ID com padding padrão", () => {
    expect(nextId([], "CT")).toBe("CT-01")
  })

  it("retorna próximo após o maior existente", () => {
    expect(nextId(["CT-01", "CT-03", "CT-02"], "CT")).toBe("CT-04")
  })

  it("ignora IDs com prefixo diferente", () => {
    expect(nextId(["SIS-10", "CT-02"], "CT")).toBe("CT-03")
  })

  it("padding 3 gera zero-pad correto", () => {
    expect(nextId([], "SIS", 3)).toBe("SIS-001")
    expect(nextId(["SIS-009"], "SIS", 3)).toBe("SIS-010")
  })

  it("ignora IDs com sufixo não numérico", () => {
    expect(nextId(["CT-abc", "CT-01"], "CT")).toBe("CT-02")
  })
})
