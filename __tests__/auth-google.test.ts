/**
 * BDD — Google OAuth: Controle de Acesso
 *
 * Feature: Login via Google OAuth
 *   Como usuário cadastrado no sistema
 *   Quero conseguir me autenticar via Google
 *   Para que eu possa acessar o sistema sem precisar de senha
 */

import { describe, it, expect } from "vitest"
import { resolveGoogleAccess, resolveGoogleInternalId } from "@/lib/auth-google"

const noInactives = new Set<string>()

describe("resolveGoogleAccess", () => {
  describe("Cenário: domínio externo sem cadastro no banco", () => {
    it("DADO que o email não está em createdUser " +
       "E não é @agrotis.com " +
       "QUANDO faz login com Google ENTÃO deve bloquear UnauthorizedDomain", () => {
      const result = resolveGoogleAccess("externo@gmail.com", null, noInactives)

      expect(result.allow).toBe(false)
      if (!result.allow) expect(result.redirect).toBe("/login?error=UnauthorizedDomain")
    })
  })

  describe("Cenário: usuário cadastrado apenas no banco (createdUser)", () => {
    it("DADO que o email existe em createdUser e está ativo " +
       "QUANDO faz login com Google ENTÃO deve permitir acesso", () => {
      const result = resolveGoogleAccess(
        "qa@empresa.com",
        { id: "U-DB-01" },
        noInactives
      )

      expect(result.allow).toBe(true)
      if (result.allow) expect(result.internalId).toBe("U-DB-01")
    })
  })

  describe("Cenário: usuário externo cadastrado no banco mas marcado como inativo", () => {
    it("DADO que o email externo existe em createdUser e está em inactiveUser " +
       "QUANDO faz login com Google ENTÃO deve ser bloqueado com GoogleInactive", () => {
      const inactives = new Set(["U-DB-01"])
      const result = resolveGoogleAccess("qa@empresa.com", { id: "U-DB-01" }, inactives)

      expect(result.allow).toBe(false)
      if (!result.allow) expect(result.redirect).toBe("/login?error=GoogleInactive")
    })
  })

  describe("Cenário: primeiro acesso de @agrotis.com não cadastrado", () => {
    it("DADO que o email é @agrotis.com e não está no banco " +
       "QUANDO faz login com Google ENTÃO deve ser auto-registrado", () => {
      const result = resolveGoogleAccess("novo@agrotis.com", null, noInactives)

      expect(result.allow).toBe(true)
      if (result.allow) expect(result.autoRegister).toBe(true)
    })
  })

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

describe("resolveGoogleInternalId", () => {
  it("Prioriza o ID do banco quando disponível", () => {
    expect(resolveGoogleInternalId("qualquer@email.com", "U-DB-99", "google-12345"))
      .toBe("U-DB-99")
  })

  it("Usa fallback OAuth ID quando não há registro no banco", () => {
    expect(resolveGoogleInternalId("novo@agrotis.com", null, "google-99999"))
      .toBe("google-99999")
  })
})
