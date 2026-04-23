import { describe, it, expect } from "vitest"
import {
  formatYmdInTz,
  isThursdayYmdBrazil,
  isValidNewChapterDate,
  isValidUpdatedChapterDate,
  listThursdayYmOptions,
  parseYmdToDbDate,
  todayYmdBrazil,
  CHAPTER_TZ,
} from "@/lib/equipe-chapter-dates"

describe("parseYmdToDbDate / formatYmdInTz", () => {
  it("parse e formata ymd estável", () => {
    const d = parseYmdToDbDate("2024-06-15")
    expect(d).not.toBeNull()
    expect(formatYmdInTz(d!, "UTC")).toBe("2024-06-15")
  })
})

describe("isThursdayYmdBrazil", () => {
  it("identifica quinta-feira civil em São Paulo", () => {
    expect(isThursdayYmdBrazil("2024-01-04")).toBe(true)
    expect(isThursdayYmdBrazil("2024-01-03")).toBe(false)
  })
  it("rejeita formato inválido", () => {
    expect(isThursdayYmdBrazil("")).toBe(false)
    expect(isThursdayYmdBrazil("nope")).toBe(false)
  })
})

describe("isValidNewChapterDate", () => {
  it("aceita quinta-feira retornada pela lista a partir da referência", () => {
    const ref = new Date("2024-01-04T15:00:00Z")
    const opts = listThursdayYmOptions(ref, { maxCount: 6 })
    expect(opts.length).toBeGreaterThan(0)
    expect(isValidNewChapterDate(opts[0]!, ref)).toBe(true)
  })
})

describe("isValidUpdatedChapterDate", () => {
  it("permite manter data anterior", () => {
    const ref = new Date("2026-04-24T12:00:00Z")
    expect(isValidUpdatedChapterDate("2024-01-04", "2024-01-04", ref)).toBe(true)
  })
})

describe("listThursdayYmOptions", () => {
  it("retorna quintas futuras ordenadas", () => {
    const ref = new Date("2024-01-10T12:00:00Z")
    const opts = listThursdayYmOptions(ref, { maxCount: 4 })
    expect(opts.length).toBeGreaterThan(0)
    for (const ymd of opts) {
      expect(isThursdayYmdBrazil(ymd)).toBe(true)
      expect(ymd >= todayYmdBrazil(ref)).toBe(true)
    }
    const sorted = [...opts].sort()
    expect(opts).toEqual(sorted)
  })
})

describe("CHAPTER_TZ", () => {
  it("é America/Sao_Paulo", () => {
    expect(CHAPTER_TZ).toBe("America/Sao_Paulo")
  })
})
