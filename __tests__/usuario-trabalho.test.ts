import { describe, it, expect } from "vitest"
import { parseHorarioInput, sanitizeFormatoTrabalho } from "@/lib/usuario-trabalho"

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
