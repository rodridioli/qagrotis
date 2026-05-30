import { describe, it, expect } from "vitest"
import { buildRole, can } from "@/core/rbac/policy"

describe("RBAC Lançamentos + Clockwork", () => {
  // Administrador:MGR: acesso ao painel de gestor (viewOthers) e clockwork
  it("Administrador:MGR tem individual.viewOthers e config.clockwork", () => {
    const role = buildRole("Administrador", "MGR")
    expect(can(role, "individual.viewOthers")).toBe(true)
    expect(can(role, "config.clockwork")).toBe(true)
  })

  // Administrador:MGR NÃO tem individual.lancamentos (tem viewOthers em vez disso)
  it("Administrador:MGR NÃO tem individual.lancamentos (usa individual.viewOthers)", () => {
    const role = buildRole("Administrador", "MGR")
    expect(can(role, "individual.lancamentos")).toBe(false)
  })

  // Padrão:QA tem acesso ao próprio painel de lançamentos (individual.lancamentos)
  it("Padrão:QA tem individual.lancamentos (próprios lançamentos)", () => {
    const role = buildRole("Padrão", "QA")
    expect(can(role, "individual.lancamentos")).toBe(true)
  })

  // Padrão:QA não tem config.clockwork (exclusivo de MGR)
  it("Padrão:QA não tem config.clockwork", () => {
    const role = buildRole("Padrão", "QA")
    expect(can(role, "config.clockwork")).toBe(false)
  })

  // Administrador:QA não tem config.clockwork nem individual.viewOthers
  it("Administrador:QA não tem capabilities exclusivas MGR (clockwork/viewOthers)", () => {
    const role = buildRole("Administrador", "QA")
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "individual.viewOthers")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
  })
})
