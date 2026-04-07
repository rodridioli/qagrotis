/**
 * BDD — Google OAuth: Controle de Acesso
 *
 * Feature: Login via Google OAuth
 *   Como usuário cadastrado no sistema
 *   Quero conseguir me autenticar via Google
 *   Para que eu possa acessar o sistema sem precisar de senha
 *
 * Reproduz o bug: rodridioli@gmail.com (MOCK_USERS U-00) era bloqueado com
 * "UnauthorizedDomain" porque o signIn callback só verificava prisma.createdUser.
 */

import { describe, it, expect } from "vitest"
import { resolveGoogleAccess, resolveGoogleInternalId } from "@/lib/auth-google"
import { MOCK_USERS } from "@/lib/qagrotis-constants"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const noInactives = new Set<string>()
const mockAdmin = MOCK_USERS.find((u) => u.email === "rodridioli@gmail.com")!

// ─────────────────────────────────────────────────────────────────────────────
// resolveGoogleAccess
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveGoogleAccess", () => {
  // ── REGRESSION: bug original ────────────────────────────────────────────
  describe(
    "Cenário: usuário rodridioli@gmail.com existe em MOCK_USERS mas não no banco",
    () => {
      it("DADO que o email existe em MOCK_USERS E não está inativo " +
         "QUANDO faz login com Google ENTÃO deve permitir acesso", () => {
        // existingCreated = null (sem registro no banco)
        const result = resolveGoogleAccess("rodridioli@gmail.com", null, noInactives)

        expect(result.allow).toBe(true)
      })

      it("E a decisão deve carregar o ID interno U-00", () => {
        const result = resolveGoogleAccess("rodridioli@gmail.com", null, noInactives)

        expect(result.allow).toBe(true)
        if (result.allow) {
          expect(result.internalId).toBe("U-00")
          expect(result.autoRegister).toBe(false)
        }
      })
    }
  )

  // ── Usuário cadastrado no banco (createdUser) ────────────────────────────
  describe("Cenário: usuário cadastrado apenas no banco (createdUser)", () => {
    it("DADO que o email existe em createdUser e está ativo " +
       "QUANDO faz login com Google ENTÃO deve permitir acesso", () => {
      const result = resolveGoogleAccess(
        "qa@agrotis.com",
        { id: "U-DB-01" },
        noInactives
      )

      expect(result.allow).toBe(true)
      if (result.allow) expect(result.internalId).toBe("U-DB-01")
    })
  })

  // ── Usuário inativo (banco, domínio externo) ─────────────────────────────
  // Nota: @agrotis.com inativo NÃO bloqueia — cria nova conta (coberto em BUG 2 abaixo)
  describe("Cenário: usuário externo cadastrado no banco mas marcado como inativo", () => {
    it("DADO que o email externo existe em createdUser e está em inactiveUser " +
       "QUANDO faz login com Google ENTÃO deve ser bloqueado com GoogleInactive", () => {
      const inactives = new Set(["U-DB-01"])
      const result = resolveGoogleAccess("qa@empresa.com", { id: "U-DB-01" }, inactives)

      expect(result.allow).toBe(false)
      if (!result.allow) expect(result.redirect).toBe("/login?error=GoogleInactive")
    })
  })

  // ── Usuário inativo (mock) ───────────────────────────────────────────────
  describe("Cenário: usuário existe em MOCK_USERS mas está inativo no banco", () => {
    it("DADO que o mock user está em inactiveUser " +
       "QUANDO faz login com Google ENTÃO deve ser bloqueado com GoogleInactive", () => {
      const inactives = new Set([mockAdmin.id]) // U-00
      const result = resolveGoogleAccess("rodridioli@gmail.com", null, inactives)

      expect(result.allow).toBe(false)
      if (!result.allow) expect(result.redirect).toBe("/login?error=GoogleInactive")
    })
  })

  // ── Usuário desconhecido, email externo ──────────────────────────────────
  describe("Cenário: email externo sem cadastro", () => {
    it("DADO que o email não existe nem no banco nem em MOCK_USERS " +
       "E não é @agrotis.com " +
       "QUANDO faz login com Google ENTÃO deve ser bloqueado com UnauthorizedDomain", () => {
      const result = resolveGoogleAccess("desconhecido@externo.com", null, noInactives)

      expect(result.allow).toBe(false)
      if (!result.allow) expect(result.redirect).toBe("/login?error=UnauthorizedDomain")
    })
  })

  // ── Auto-registro @agrotis.com ───────────────────────────────────────────
  describe("Cenário: primeiro acesso de @agrotis.com não cadastrado", () => {
    it("DADO que o email é @agrotis.com e não está no banco nem em MOCK_USERS " +
       "QUANDO faz login com Google ENTÃO deve ser auto-registrado", () => {
      const result = resolveGoogleAccess("novo@agrotis.com", null, noInactives)

      expect(result.allow).toBe(true)
      if (result.allow) expect(result.autoRegister).toBe(true)
    })
  })

  // ── BUG 2 REGRESSÃO: @agrotis.com com registro inativo no banco ──────────
  // Nota de integração: quando autoRegister=true E existingCreated!=null,
  // o signIn callback em auth.ts REATIVA (deleteMany InactiveUser + update name)
  // em vez de CREATE, evitando P2002 (unique constraint em CreatedUser.email).
  describe(
    "Cenário: @agrotis.com com createdUser inativo — deve sinalizar autoRegister (BUG 2)",
    () => {
      const inactiveAgrotis = new Set(["U-DB-OLD"])

      it("DADO que o email é @agrotis.com " +
         "E existe um createdUser com ID 'U-DB-OLD' marcado como inativo " +
         "QUANDO faz login com Google " +
         "ENTÃO deve retornar allow=true e autoRegister=true (reativação no signIn)", () => {
        const result = resolveGoogleAccess(
          "reativado@agrotis.com",
          { id: "U-DB-OLD" },
          inactiveAgrotis
        )

        expect(result.allow).toBe(true)
        if (result.allow) expect(result.autoRegister).toBe(true)
      })

      it("E NÃO deve retornar GoogleInactive para @agrotis.com com registro inativo", () => {
        const result = resolveGoogleAccess(
          "reativado@agrotis.com",
          { id: "U-DB-OLD" },
          inactiveAgrotis
        )

        expect(result).not.toMatchObject({
          allow: false,
          redirect: "/login?error=GoogleInactive",
        })
      })
    }
  )

  // ── @agrotis.com ativo no banco — sem novo registro ──────────────────────
  describe("Cenário: @agrotis.com já cadastrado e ativo no banco", () => {
    it("DADO que email é @agrotis.com E createdUser está ativo " +
       "QUANDO faz login com Google " +
       "ENTÃO deve permitir acesso com autoRegister=false e internalId correto", () => {
      const result = resolveGoogleAccess(
        "ativo@agrotis.com",
        { id: "U-DB-ACTIVE" },
        noInactives
      )

      expect(result.allow).toBe(true)
      if (result.allow) {
        expect(result.autoRegister).toBe(false)
        expect(result.internalId).toBe("U-DB-ACTIVE")
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveGoogleInternalId
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveGoogleInternalId", () => {
  it("Prioriza o ID do banco quando disponível", () => {
    expect(resolveGoogleInternalId("rodridioli@gmail.com", "U-DB-99", "google-12345"))
      .toBe("U-DB-99")
  })

  it("REGRESSÃO: usa ID do MOCK_USERS quando não há registro no banco", () => {
    expect(resolveGoogleInternalId("rodridioli@gmail.com", null, "google-12345"))
      .toBe("U-00")
  })

  it("Usa fallback OAuth ID quando email não está em nenhum store", () => {
    expect(resolveGoogleInternalId("novo@agrotis.com", null, "google-99999"))
      .toBe("google-99999")
  })
})
