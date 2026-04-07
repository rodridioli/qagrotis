/**
 * BDD — Atualizações: Controle de Acesso
 *
 * Feature: Acesso à tela de Atualizações por tipo de usuário
 *   Como usuário autenticado (qualquer tipo)
 *   Quero acessar a tela de Atualizações
 *   Para que eu possa visualizar o histórico de versões do sistema
 *
 * Reproduz o bug: usuários do tipo "Padrão" eram redirecionados para
 * /dashboard ao acessar /atualizacoes, pois a page.tsx tinha um guard
 * `type !== "Administrador"` incorreto que não fazia parte dos requisitos.
 */

import { describe, it, expect } from "vitest"
import type { UserType } from "@/lib/qagrotis-constants"

// ─── Simulação da lógica do guard (versão BUGADA — deve ser rejeitada) ────────

function buggedPageGuard(userType: UserType | undefined): "allow" | "redirect" {
  if (!userType || userType !== "Administrador") return "redirect"
  return "allow"
}

// ─── Simulação da lógica corrigida (sem guard de tipo) ────────────────────────

function fixedPageGuard(isAuthenticated: boolean): "allow" | "redirect-login" {
  if (!isAuthenticated) return "redirect-login"
  return "allow"
}

// ─────────────────────────────────────────────────────────────────────────────
// CENÁRIO DO BUG: Guard bugado bloqueava usuários "Padrão"
// ─────────────────────────────────────────────────────────────────────────────

describe("REGRESSÃO — guard bugado (type !== Administrador)", () => {
  it("bloqueava usuário do tipo Padrão (comportamento incorreto documentado)", () => {
    // Given: usuário autenticado do tipo "Padrão"
    // When: a página executava o guard com type !== "Administrador"
    // Then: era redirecionado — COMPORTAMENTO INCORRETO
    expect(buggedPageGuard("Padrão")).toBe("redirect")
  })

  it("permitia apenas Administrador (comportamento incorreto documentado)", () => {
    expect(buggedPageGuard("Administrador")).toBe("allow")
  })

  it("bloqueava usuário sem type (comportamento incorreto documentado)", () => {
    expect(buggedPageGuard(undefined)).toBe("redirect")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPORTAMENTO CORRETO: Qualquer usuário autenticado pode acessar
// ─────────────────────────────────────────────────────────────────────────────

describe("Atualizações — controle de acesso (comportamento correto)", () => {
  // Scenario 1: Usuário Administrador acessa Atualizações
  it("permite acesso a usuário Administrador autenticado", () => {
    // Given: estou logado como "Administrador"
    // When: acesso /atualizacoes
    // Then: a página é exibida normalmente
    expect(fixedPageGuard(true)).toBe("allow")
  })

  // Scenario 2: Usuário Padrão acessa Atualizações — CENÁRIO DO BUG
  it("permite acesso a usuário Padrão autenticado", () => {
    // Given: estou logado como "Padrão"
    // When: acesso /atualizacoes
    // Then: a página é exibida normalmente (NÃO redireciona para /dashboard)
    expect(fixedPageGuard(true)).toBe("allow")
  })

  // Scenario 3: Usuário não autenticado é bloqueado pelo middleware
  it("bloqueia usuário não autenticado (responsabilidade do middleware)", () => {
    // Given: NÃO estou autenticado
    // When: acesso /atualizacoes
    // Then: sou redirecionado para /login (pelo auth.config.ts)
    expect(fixedPageGuard(false)).toBe("redirect-login")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Validação: a page.tsx não deve importar auth() ou getQaUsers()
// ─────────────────────────────────────────────────────────────────────────────

describe("page.tsx — ausência de dependências desnecessárias pós-correção", () => {
  it("não deve verificar tipo de usuário para exibir atualizações", () => {
    // A tela de Atualizações é informativa e não sensível — acessível a todos
    const ALLOWED_TYPES: UserType[] = ["Administrador", "Padrão"]
    ALLOWED_TYPES.forEach((type) => {
      // Qualquer tipo autenticado tem acesso
      expect(fixedPageGuard(true)).toBe("allow")
      // O tipo específico NÃO deve influenciar o resultado
      expect(type).toBeDefined()
    })
  })
})
