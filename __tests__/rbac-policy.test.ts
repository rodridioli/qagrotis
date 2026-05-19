/**
 * BDD — RBAC Policy (cobertura completa)
 *
 * Feature: Controle de acesso baseado em role
 *   Como sistema
 *   Quero garantir que cada role tenha exatamente as capabilities corretas
 *   Para que nenhum usuário acesse recursos além do seu perfil
 */

import { describe, it, expect } from "vitest"
import {
  buildRole,
  can,
  isDisabled,
  isVisible,
  manageableProfiles,
  canEditUserField,
  type Role,
  type Capability,
} from "@/core/rbac/policy"

// ─── buildRole: fallback defensivo ───────────────────────────────────────────

describe("buildRole", () => {
  it("mapeia Administrador:QA corretamente", () => {
    expect(buildRole("Administrador", "QA")).toBe("Administrador:QA")
  })

  it("mapeia Padrão:UX corretamente", () => {
    expect(buildRole("Padrão", "UX")).toBe("Padrão:UX")
  })

  it("mapeia Administrador:MGR corretamente", () => {
    expect(buildRole("Administrador", "MGR")).toBe("Administrador:MGR")
  })

  it("fallback de tipo desconhecido → Padrão", () => {
    expect(buildRole("Desconhecido", "QA")).toBe("Padrão:QA")
  })

  it("fallback de perfil desconhecido → QA", () => {
    expect(buildRole("Administrador", "XPTO")).toBe("Administrador:QA")
  })

  it("fallback de null/undefined → Padrão:QA", () => {
    expect(buildRole(null, null)).toBe("Padrão:QA")
    expect(buildRole(undefined, undefined)).toBe("Padrão:QA")
  })

  it("Padrão:MGR é combinação inválida — buildRole a representa (sem capabilities)", () => {
    const role = buildRole("Padrão", "MGR")
    expect(role).toBe("Padrão:MGR")
    // combinação fechada: sem acesso a nada
    expect(can(role, "menu.painel")).toBe(false)
  })
})

// ─── Padrão:QA ───────────────────────────────────────────────────────────────

describe("Padrão:QA", () => {
  const role = buildRole("Padrão", "QA")

  it("tem acesso ao menu principal QA", () => {
    const menus: Capability[] = [
      "menu.painel", "menu.suites", "menu.cenarios", "menu.gerador",
      "menu.documentos", "menu.assistente", "menu.equipe",
      "menu.individual", "menu.configuracoes", "menu.atualizacoes",
    ]
    menus.forEach((cap) => expect(can(role, cap)).toBe(true))
  })

  it("tem config.clientes, config.credenciais e config.meuCadastro", () => {
    expect(can(role, "config.clientes")).toBe(true)
    expect(can(role, "config.credenciais")).toBe(true)
    expect(can(role, "config.meuCadastro")).toBe(true)
  })

  it("NÃO tem capabilities de admin", () => {
    expect(can(role, "config.usuarios")).toBe(false)
    expect(can(role, "config.sistemas")).toBe(false)
    expect(can(role, "config.modulos")).toBe(false)
    expect(can(role, "users.create")).toBe(false)
    expect(can(role, "users.editProfileFields")).toBe(false)
  })

  it("NÃO tem capabilities de MGR", () => {
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "individual.viewOthers")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
    expect(can(role, "config.modelosIA")).toBe(false)
    expect(can(role, "config.jira")).toBe(false)
  })

  it("NÃO tem equipe.performance nem equipe.performance.filterByProfile", () => {
    expect(can(role, "equipe.performance")).toBe(false)
    expect(can(role, "equipe.performance.filterByProfile")).toBe(false)
  })

  it("não gerencia nenhum perfil", () => {
    expect(manageableProfiles(role)).toHaveLength(0)
  })
})

// ─── Administrador:QA ────────────────────────────────────────────────────────

describe("Administrador:QA", () => {
  const role = buildRole("Administrador", "QA")

  it("tem acesso ao menu principal QA", () => {
    expect(can(role, "menu.painel")).toBe(true)
    expect(can(role, "menu.suites")).toBe(true)
    expect(can(role, "menu.cenarios")).toBe(true)
    expect(can(role, "menu.gerador")).toBe(true)
    expect(can(role, "menu.documentos")).toBe(true)
    expect(can(role, "menu.assistente")).toBe(true)
  })

  it("tem config.usuarios, config.sistemas, config.modulos e users.create", () => {
    expect(can(role, "config.usuarios")).toBe(true)
    expect(can(role, "config.sistemas")).toBe(true)
    expect(can(role, "config.modulos")).toBe(true)
    expect(can(role, "users.create")).toBe(true)
  })

  it("tem equipe.performance e equipe.lancamentos", () => {
    expect(can(role, "equipe.performance")).toBe(true)
    expect(can(role, "equipe.lancamentos")).toBe(true)
  })

  it("NÃO tem capabilities exclusivas de MGR", () => {
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "individual.viewOthers")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
    expect(can(role, "config.modelosIA")).toBe(false)
    expect(can(role, "config.jira")).toBe(false)
    expect(can(role, "users.editProfileFields")).toBe(false)
    expect(can(role, "equipe.performance.filterByProfile")).toBe(false)
  })

  it("gerencia apenas perfil QA", () => {
    expect(manageableProfiles(role)).toEqual(["QA"])
  })
})

// ─── Padrão:UX ───────────────────────────────────────────────────────────────

describe("Padrão:UX", () => {
  const role = buildRole("Padrão", "UX")

  it("tem menu.painel, menu.assistente, menu.equipe, menu.individual, menu.configuracoes, menu.atualizacoes", () => {
    expect(can(role, "menu.painel")).toBe(true)
    expect(can(role, "menu.assistente")).toBe(true)
    expect(can(role, "menu.equipe")).toBe(true)
    expect(can(role, "menu.individual")).toBe(true)
    expect(can(role, "menu.configuracoes")).toBe(true)
    expect(can(role, "menu.atualizacoes")).toBe(true)
  })

  it("NÃO tem acesso a menus QA-específicos", () => {
    expect(can(role, "menu.suites")).toBe(false)
    expect(can(role, "menu.cenarios")).toBe(false)
    expect(can(role, "menu.gerador")).toBe(false)
  })

  it("menu.documentos aparece disabled (visível mas cinza)", () => {
    expect(can(role, "menu.documentos")).toBe(false)
    expect(isDisabled(role, "menu.documentos")).toBe(true)
    expect(isVisible(role, "menu.documentos")).toBe(true)
  })

  it("tem config.meuCadastro", () => {
    expect(can(role, "config.meuCadastro")).toBe(true)
  })

  it("NÃO tem capabilities de admin ou MGR", () => {
    expect(can(role, "config.usuarios")).toBe(false)
    expect(can(role, "users.create")).toBe(false)
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "equipe.performance")).toBe(false)
  })

  it("não gerencia nenhum perfil", () => {
    expect(manageableProfiles(role)).toHaveLength(0)
  })
})

// ─── Administrador:UX ────────────────────────────────────────────────────────

describe("Administrador:UX", () => {
  const role = buildRole("Administrador", "UX")

  it("tem config.usuarios e users.create", () => {
    expect(can(role, "config.usuarios")).toBe(true)
    expect(can(role, "users.create")).toBe(true)
  })

  it("menu.documentos ainda aparece disabled mesmo sendo admin UX", () => {
    expect(can(role, "menu.documentos")).toBe(false)
    expect(isDisabled(role, "menu.documentos")).toBe(true)
  })

  it("tem equipe.performance e equipe.lancamentos", () => {
    expect(can(role, "equipe.performance")).toBe(true)
    expect(can(role, "equipe.lancamentos")).toBe(true)
  })

  it("NÃO tem capabilities exclusivas de MGR", () => {
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
    expect(can(role, "config.modelosIA")).toBe(false)
    expect(can(role, "users.editProfileFields")).toBe(false)
    expect(can(role, "equipe.performance.filterByProfile")).toBe(false)
  })

  it("gerencia apenas perfil UX", () => {
    expect(manageableProfiles(role)).toEqual(["UX"])
  })
})

// ─── Padrão:TW ───────────────────────────────────────────────────────────────

describe("Padrão:TW", () => {
  const role = buildRole("Padrão", "TW")

  it("tem mesmo conjunto de menus que Padrão:UX", () => {
    expect(can(role, "menu.painel")).toBe(true)
    expect(can(role, "menu.assistente")).toBe(true)
    expect(can(role, "menu.equipe")).toBe(true)
    expect(can(role, "menu.individual")).toBe(true)
    expect(can(role, "menu.configuracoes")).toBe(true)
  })

  it("menu.documentos aparece disabled", () => {
    expect(isDisabled(role, "menu.documentos")).toBe(true)
    expect(can(role, "menu.documentos")).toBe(false)
  })

  it("NÃO tem acesso a menus QA-específicos", () => {
    expect(can(role, "menu.suites")).toBe(false)
    expect(can(role, "menu.cenarios")).toBe(false)
    expect(can(role, "menu.gerador")).toBe(false)
  })

  it("não gerencia nenhum perfil", () => {
    expect(manageableProfiles(role)).toHaveLength(0)
  })
})

// ─── Administrador:TW ────────────────────────────────────────────────────────

describe("Administrador:TW", () => {
  const role = buildRole("Administrador", "TW")

  it("tem config.usuarios e users.create", () => {
    expect(can(role, "config.usuarios")).toBe(true)
    expect(can(role, "users.create")).toBe(true)
  })

  it("menu.documentos ainda disabled", () => {
    expect(isDisabled(role, "menu.documentos")).toBe(true)
    expect(can(role, "menu.documentos")).toBe(false)
  })

  it("NÃO tem capabilities exclusivas de MGR", () => {
    expect(can(role, "individual.lancamentos")).toBe(false)
    expect(can(role, "config.clockwork")).toBe(false)
    expect(can(role, "users.editProfileFields")).toBe(false)
    expect(can(role, "equipe.performance.filterByProfile")).toBe(false)
  })

  it("gerencia apenas perfil TW", () => {
    expect(manageableProfiles(role)).toEqual(["TW"])
  })
})

// ─── Padrão:MGR (combinação inválida — fallback fechado) ─────────────────────

describe("Padrão:MGR (inválido)", () => {
  const role = buildRole("Padrão", "MGR")

  it("não tem nenhuma capability", () => {
    const allCaps: Capability[] = [
      "menu.painel", "menu.suites", "menu.cenarios", "menu.gerador",
      "menu.documentos", "menu.assistente", "menu.equipe", "menu.configuracoes",
      "menu.atualizacoes", "menu.individual", "individual.viewOthers",
      "individual.lancamentos", "topbar.sistemaSelector", "config.usuarios",
      "config.sistemas", "config.modulos", "config.clientes", "config.modelosIA",
      "config.jira", "config.clockwork", "config.meuCadastro", "config.credenciais",
      "users.create", "users.editProfileFields", "equipe.performance",
      "equipe.performance.filterByProfile", "equipe.lancamentos",
    ]
    allCaps.forEach((cap) => expect(can(role, cap)).toBe(false))
  })

  it("não gerencia nenhum perfil", () => {
    expect(manageableProfiles(role)).toHaveLength(0)
  })
})

// ─── Administrador:MGR ───────────────────────────────────────────────────────

describe("Administrador:MGR", () => {
  const role = buildRole("Administrador", "MGR")

  it("tem individual.lancamentos e individual.viewOthers (exclusivos MGR)", () => {
    expect(can(role, "individual.lancamentos")).toBe(true)
    expect(can(role, "individual.viewOthers")).toBe(true)
  })

  it("tem config.clockwork, config.modelosIA, config.jira (exclusivos MGR)", () => {
    expect(can(role, "config.clockwork")).toBe(true)
    expect(can(role, "config.modelosIA")).toBe(true)
    expect(can(role, "config.jira")).toBe(true)
  })

  it("tem users.editProfileFields", () => {
    expect(can(role, "users.editProfileFields")).toBe(true)
  })

  it("tem equipe.performance.filterByProfile", () => {
    expect(can(role, "equipe.performance.filterByProfile")).toBe(true)
  })

  it("tem users.create e config.usuarios", () => {
    expect(can(role, "users.create")).toBe(true)
    expect(can(role, "config.usuarios")).toBe(true)
  })

  it("tem menu.documentos (sem disabled)", () => {
    expect(can(role, "menu.documentos")).toBe(true)
    expect(isDisabled(role, "menu.documentos")).toBe(false)
  })

  it("NÃO tem config.clientes, config.credenciais, config.sistemas, config.modulos", () => {
    expect(can(role, "config.clientes")).toBe(false)
    expect(can(role, "config.credenciais")).toBe(false)
    expect(can(role, "config.sistemas")).toBe(false)
    expect(can(role, "config.modulos")).toBe(false)
  })

  it("gerencia todos os perfis: QA, UX, TW, MGR", () => {
    expect(manageableProfiles(role)).toEqual(["QA", "UX", "TW", "MGR"])
  })
})

// ─── isVisible ───────────────────────────────────────────────────────────────

describe("isVisible", () => {
  it("item com can=true é visível", () => {
    expect(isVisible(buildRole("Padrão", "QA"), "menu.painel")).toBe(true)
  })

  it("item disabled é visível mas não ativo", () => {
    const role = buildRole("Padrão", "UX")
    expect(isVisible(role, "menu.documentos")).toBe(true)
    expect(can(role, "menu.documentos")).toBe(false)
    expect(isDisabled(role, "menu.documentos")).toBe(true)
  })

  it("item sem can e sem disabled não é visível", () => {
    expect(isVisible(buildRole("Padrão", "QA"), "individual.lancamentos")).toBe(false)
  })
})

// ─── canEditUserField ─────────────────────────────────────────────────────────

describe("canEditUserField", () => {
  it("Administrador:MGR pode editar os próprios campos de perfil", () => {
    expect(canEditUserField(buildRole("Administrador", "MGR"), true, "MGR")).toBe(true)
  })

  it("Administrador:QA NÃO pode editar os próprios campos de perfil (não tem users.editProfileFields)", () => {
    expect(canEditUserField(buildRole("Administrador", "QA"), true, "QA")).toBe(false)
  })

  it("Padrão:QA NÃO pode editar campos de perfil (nem próprios)", () => {
    expect(canEditUserField(buildRole("Padrão", "QA"), true, "QA")).toBe(false)
  })

  it("Administrador:MGR pode editar campos de outro usuário QA (gerencia QA)", () => {
    expect(canEditUserField(buildRole("Administrador", "MGR"), false, "QA")).toBe(true)
  })

  it("Administrador:MGR pode editar campos de outro usuário MGR (gerencia MGR)", () => {
    expect(canEditUserField(buildRole("Administrador", "MGR"), false, "MGR")).toBe(true)
  })

  it("Administrador:QA pode editar campos de outro usuário QA (gerencia QA)", () => {
    expect(canEditUserField(buildRole("Administrador", "QA"), false, "QA")).toBe(true)
  })

  it("Administrador:QA NÃO pode editar outro usuário UX (não gerencia UX)", () => {
    expect(canEditUserField(buildRole("Administrador", "QA"), false, "UX")).toBe(false)
  })

  it("retorna false quando targetProfile é null", () => {
    expect(canEditUserField(buildRole("Administrador", "MGR"), false, null)).toBe(false)
  })
})

// ─── Separação estrita: capabilities exclusivas por role ─────────────────────

describe("separação de capabilities exclusivas", () => {
  const adminMgr = buildRole("Administrador", "MGR")
  const allOthers: Role[] = [
    "Padrão:QA", "Administrador:QA",
    "Padrão:UX", "Administrador:UX",
    "Padrão:TW", "Administrador:TW",
    "Padrão:MGR",
  ]

  const mgrExclusive: Capability[] = [
    "individual.lancamentos",
    "individual.viewOthers",
    "config.clockwork",
    "config.modelosIA",
    "config.jira",
    "users.editProfileFields",
    "equipe.performance.filterByProfile",
  ]

  it.each(mgrExclusive)("capability '%s' é exclusiva de Administrador:MGR", (cap) => {
    expect(can(adminMgr, cap)).toBe(true)
    allOthers.forEach((other) => {
      expect(can(other, cap)).toBe(false)
    })
  })

  it("config.meuCadastro é acessível por Padrão:QA, Padrão:UX, Padrão:TW mas NÃO por admins ou MGR", () => {
    expect(can(buildRole("Padrão", "QA"), "config.meuCadastro")).toBe(true)
    expect(can(buildRole("Padrão", "UX"), "config.meuCadastro")).toBe(true)
    expect(can(buildRole("Padrão", "TW"), "config.meuCadastro")).toBe(true)
    expect(can(buildRole("Administrador", "QA"), "config.meuCadastro")).toBe(false)
    expect(can(buildRole("Administrador", "UX"), "config.meuCadastro")).toBe(false)
    expect(can(buildRole("Administrador", "TW"), "config.meuCadastro")).toBe(false)
    expect(can(buildRole("Administrador", "MGR"), "config.meuCadastro")).toBe(false)
  })
})
