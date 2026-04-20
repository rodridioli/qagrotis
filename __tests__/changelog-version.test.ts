import { describe, it, expect } from "vitest"
import { formatChangelogVersionForDisplay } from "@/lib/changelog-version"

describe("formatChangelogVersionForDisplay", () => {
  it("mantém 1.6.9", () => {
    expect(formatChangelogVersionForDisplay("1.6.9")).toBe("1.6.9")
  })
  it("1.6.10 → 1.7.0", () => {
    expect(formatChangelogVersionForDisplay("1.6.10")).toBe("1.7.0")
  })
  it("1.6.18 → 1.7.8", () => {
    expect(formatChangelogVersionForDisplay("1.6.18")).toBe("1.7.8")
  })
  it("1.9.9 → 2.0.0", () => {
    expect(formatChangelogVersionForDisplay("1.9.9")).toBe("2.0.0")
  })
  it("aceita prefixo v", () => {
    expect(formatChangelogVersionForDisplay("v1.6.10")).toBe("1.7.0")
  })
})
