import { describe, it, expect } from "vitest"
import { buildRole, can, canEditUserField, type Role } from "./policy"

describe("buildRole", () => {
  it("Administrador + MGR → Administrador:MGR", () => {
    expect(buildRole("Administrador", "MGR")).toBe("Administrador:MGR")
  })

  it("Padrão + QA → Padrão:QA", () => {
    expect(buildRole("Padrão", "QA")).toBe("Padrão:QA")
  })

  it("tipo inválido cai em Padrão", () => {
    expect(buildRole("Desconhecido", "QA")).toBe("Padrão:QA")
  })

  it("perfil inválido cai em QA", () => {
    expect(buildRole("Administrador", "NINJA")).toBe("Administrador:QA")
  })

  it("null/undefined resulta em Padrão:QA", () => {
    expect(buildRole(null, null)).toBe("Padrão:QA")
    expect(buildRole(undefined, undefined)).toBe("Padrão:QA")
  })
})

describe("can()", () => {
  it("Administrador:MGR pode records.hardDelete", () => {
    expect(can("Administrador:MGR", "records.hardDelete")).toBe(true)
  })

  it("Padrão:QA NÃO pode records.hardDelete", () => {
    expect(can("Padrão:QA", "records.hardDelete")).toBe(false)
  })

  it("Administrador:MGR pode users.create e users.editProfileFields", () => {
    expect(can("Administrador:MGR", "users.create")).toBe(true)
    expect(can("Administrador:MGR", "users.editProfileFields")).toBe(true)
  })

  it("Padrão:QA NÃO pode users.create", () => {
    expect(can("Padrão:QA", "users.create")).toBe(false)
  })

  it("Padrão:QA pode config.jira", () => {
    expect(can("Padrão:QA", "config.jira")).toBe(true)
  })

  it("Administrador:MGR pode menu.gestao", () => {
    expect(can("Administrador:MGR", "menu.gestao")).toBe(true)
  })

  it("Padrão:QA NÃO pode menu.gestao", () => {
    expect(can("Padrão:QA", "menu.gestao")).toBe(false)
  })

  it("Padrão:MGR (inválido) sem nenhuma capability", () => {
    expect(can("Padrão:MGR", "menu.painel")).toBe(false)
  })

  it("Padrão:UX pode equipe.clockwork", () => {
    expect(can("Padrão:UX", "equipe.clockwork")).toBe(true)
  })
})

describe("canEditUserField()", () => {
  it("Administrador:MGR pode editar próprio cadastro (self-edit)", () => {
    expect(canEditUserField("Administrador:MGR", true, null)).toBe(true)
  })

  it("Padrão:QA NÃO pode editar próprio cadastro (sem users.editProfileFields)", () => {
    expect(canEditUserField("Padrão:QA", true, null)).toBe(false)
  })

  it("Administrador:MGR pode editar outro usuário QA (gerenciável)", () => {
    expect(canEditUserField("Administrador:MGR", false, "QA")).toBe(true)
  })

  it("Administrador:MGR pode editar outro usuário UX, TW, MGR", () => {
    expect(canEditUserField("Administrador:MGR", false, "UX")).toBe(true)
    expect(canEditUserField("Administrador:MGR", false, "TW")).toBe(true)
    expect(canEditUserField("Administrador:MGR", false, "MGR")).toBe(true)
  })

  it("Administrador:QA pode editar outro usuário QA, não UX", () => {
    expect(canEditUserField("Administrador:QA", false, "QA")).toBe(true)
    expect(canEditUserField("Administrador:QA", false, "UX")).toBe(false)
  })

  it("targetProfile null em edit-other retorna false", () => {
    expect(canEditUserField("Administrador:MGR", false, null)).toBe(false)
  })

  it("Padrão:QA não pode editar outro usuário QA", () => {
    expect(canEditUserField("Padrão:QA", false, "QA")).toBe(false)
  })
})
