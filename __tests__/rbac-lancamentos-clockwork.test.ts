import { describe, it, expect } from "vitest"
import { buildRole, can } from "@/core/rbac/policy"

describe("RBAC Lançamentos + Clockwork (Administrador:MGR)", () => {
  it("Administrador:MGR tem individual.lancamentos e config.clockwork", () => {
    const role = buildRole("Administrador", "MGR")
    expect(can(role, "individual.lancamentos")).toBe(true)
    expect(can(role, "config.clockwork")).toBe(true)
  })

  it("Padrão:QA não tem individual.lancamentos nem config.clockwork", () => {
    const role = buildRole("Padrão", "QA")
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
  })

  it("Administrador:QA não tem capabilities exclusivas MGR", () => {
    const role = buildRole("Administrador", "QA")
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
  })
})
