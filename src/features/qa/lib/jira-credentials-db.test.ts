import { describe, it, expect, vi } from "vitest"

vi.mock("@/core/prisma", () => ({ prisma: {} }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@/core/db-utils", () => ({
  encryptField: (v: string) => v,
  decryptField: (v: string) => v,
}))

import { isAllowedJiraUrl, isSameJiraHost } from "./jira-credentials-db"

describe("isAllowedJiraUrl()", () => {
  it("URL https válida é permitida", () => {
    expect(isAllowedJiraUrl("https://empresa.atlassian.net")).toBe(true)
  })

  it("http é bloqueado", () => {
    expect(isAllowedJiraUrl("http://empresa.atlassian.net")).toBe(false)
  })

  it("localhost é bloqueado", () => {
    expect(isAllowedJiraUrl("https://localhost")).toBe(false)
  })

  it("127.0.0.1 é bloqueado", () => {
    expect(isAllowedJiraUrl("https://127.0.0.1")).toBe(false)
  })

  it("::1 (IPv6 loopback) é bloqueado", () => {
    expect(isAllowedJiraUrl("https://[::1]")).toBe(false)
  })

  it("10.x.x.x (RFC 1918) é bloqueado", () => {
    expect(isAllowedJiraUrl("https://10.0.0.1")).toBe(false)
    expect(isAllowedJiraUrl("https://10.255.255.255")).toBe(false)
  })

  it("192.168.x.x (RFC 1918) é bloqueado", () => {
    expect(isAllowedJiraUrl("https://192.168.1.1")).toBe(false)
  })

  it("172.16.x.x–172.31.x.x (RFC 1918) é bloqueado", () => {
    expect(isAllowedJiraUrl("https://172.16.0.1")).toBe(false)
    expect(isAllowedJiraUrl("https://172.31.255.255")).toBe(false)
  })

  it("172.15.x.x (fora do range privado) é permitido", () => {
    expect(isAllowedJiraUrl("https://172.15.0.1")).toBe(true)
  })

  it("172.32.x.x (fora do range privado) é permitido", () => {
    expect(isAllowedJiraUrl("https://172.32.0.1")).toBe(true)
  })

  it("169.254.x.x (link-local) é bloqueado", () => {
    expect(isAllowedJiraUrl("https://169.254.1.1")).toBe(false)
  })

  it("URL malformada retorna false", () => {
    expect(isAllowedJiraUrl("not-a-url")).toBe(false)
    expect(isAllowedJiraUrl("")).toBe(false)
  })
})

describe("isSameJiraHost()", () => {
  it("mesmo host é permitido", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "https://empresa.atlassian.net/rest/api/2/issue")).toBe(true)
  })

  it("subdomínio de atlassian.net é permitido", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "https://media.atlassian.com/attach/file")).toBe(true)
  })

  it("host diferente não relacionado é bloqueado", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "https://evil.com/steal")).toBe(false)
  })

  it("http no target é bloqueado mesmo com host correto", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "http://empresa.atlassian.net/rest")).toBe(false)
  })

  it("URL malformada retorna false", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "not-a-url")).toBe(false)
    expect(isSameJiraHost("not-a-url", "https://empresa.atlassian.net")).toBe(false)
  })

  it("case-insensitive no hostname", () => {
    expect(isSameJiraHost("https://Empresa.Atlassian.Net", "https://empresa.atlassian.net/rest")).toBe(true)
  })

  it("atlassian.com e media.atlassian.com são permitidos", () => {
    expect(isSameJiraHost("https://empresa.atlassian.net", "https://id.atlassian.com/login")).toBe(true)
    expect(isSameJiraHost("https://empresa.atlassian.net", "https://media.atlassian.com/img.png")).toBe(true)
  })
})
