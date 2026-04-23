import { describe, it, expect } from "vitest"
import {
  diasTrabalhoHibridoForStorage,
  normalizeDiasTrabalhoHibrido,
  parseHorarioInput,
  sanitizeFormatoTrabalho,
} from "@/lib/usuario-trabalho"

describe("parseHorarioInput", () => {
  it("aceita HH:mm válido", () => {
    expect(parseHorarioInput("08:30")).toBe("08:30")
    expect(parseHorarioInput("  09:05  ")).toBe("09:05")
  })
  it("rejeita inválido ou vazio", () => {
    expect(parseHorarioInput("")).toBeNull()
    expect(parseHorarioInput("25:00")).toBeNull()
    expect(parseHorarioInput("8:30")).toBeNull()
  })
})

describe("sanitizeFormatoTrabalho", () => {
  it("aceita valores permitidos", () => {
    expect(sanitizeFormatoTrabalho("Presencial")).toBe("Presencial")
    expect(sanitizeFormatoTrabalho(" Híbrido ")).toBe("Híbrido")
  })
  it("rejeita desconhecido ou vazio", () => {
    expect(sanitizeFormatoTrabalho("")).toBeNull()
    expect(sanitizeFormatoTrabalho("Home")).toBeNull()
  })
})

describe("normalizeDiasTrabalhoHibrido", () => {
  it("ordena e remove desconhecidos", () => {
    expect(normalizeDiasTrabalhoHibrido(["qua", "seg", "seg", "foo"])).toEqual(["seg", "qua"])
  })
  it("aceita não-array como vazio", () => {
    expect(normalizeDiasTrabalhoHibrido(null)).toEqual([])
  })
})

describe("diasTrabalhoHibridoForStorage", () => {
  it("só persiste em modo Híbrido", () => {
    expect(diasTrabalhoHibridoForStorage("Presencial", ["seg"])).toBeNull()
    expect(diasTrabalhoHibridoForStorage("Híbrido", ["seg", "dom"])).toEqual(["seg", "dom"])
  })
  it("lista vazia vira null", () => {
    expect(diasTrabalhoHibridoForStorage("Híbrido", [])).toBeNull()
  })
})
