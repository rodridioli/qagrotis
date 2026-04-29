import { describe, it, expect } from "vitest"
import { normalizeJiraIssueKey } from "@/lib/jira-issue-key"

describe("normalizeJiraIssueKey", () => {
  it("aceita projeto em minúsculas", () => {
    expect(normalizeJiraIssueKey("ux-951")).toBe("UX-951")
  })
  it("mantém chave já em maiúsculas", () => {
    expect(normalizeJiraIssueKey("UX-951")).toBe("UX-951")
  })
  it("extrai da URL browse", () => {
    expect(
      normalizeJiraIssueKey("https://agrotis.atlassian.net/browse/ux-951?focusedCommentId=1"),
    ).toBe("UX-951")
  })
  it("rejeita formato inválido", () => {
    expect(normalizeJiraIssueKey("")).toBeNull()
    expect(normalizeJiraIssueKey("951-UX")).toBeNull()
  })
})
