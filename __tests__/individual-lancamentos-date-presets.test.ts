import { describe, it, expect } from "vitest"
import { getLancamentosPresetRange, toIsoLocal } from "@/features/individual/lib/individual-lancamentos-date-presets"

describe("individual-lancamentos-date-presets", () => {
  it("toIsoLocal formata YYYY-MM-DD em data local", () => {
    expect(toIsoLocal(new Date(2026, 4, 12))).toBe("2026-05-12")
  })

  it("today: from e to iguais ao dia civil", () => {
    const fixed = new Date(2026, 0, 15, 14, 30, 0)
    const r = getLancamentosPresetRange("today", fixed)
    expect(r).toEqual({ from: "2026-01-15", to: "2026-01-15" })
  })

  it("week: segunda a domingo da semana, to não passa de hoje", () => {
    const wed = new Date(2026, 0, 14, 12, 0, 0)
    const r = getLancamentosPresetRange("week", wed)
    expect(r.from).toBe("2026-01-12")
    expect(r.to).toBe("2026-01-14")
  })

  it("month: primeiro dia do mês até hoje dentro do mês", () => {
    const mid = new Date(2026, 2, 20, 8, 0, 0)
    const r = getLancamentosPresetRange("month", mid)
    expect(r.from).toBe("2026-03-01")
    expect(r.to).toBe("2026-03-20")
  })

  it("lastMonth: mês civil anterior completo", () => {
    const mid = new Date(2026, 2, 20, 8, 0, 0)
    const r = getLancamentosPresetRange("lastMonth", mid)
    expect(r.from).toBe("2026-02-01")
    expect(r.to).toBe("2026-02-28")
  })
})
