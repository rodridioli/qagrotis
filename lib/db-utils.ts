/**
 * Shared utilities for the data layer.
 *
 * - nextId        : safe sequential ID generation (e.g. "CT-001", "SIS-01")
 * - hashPassword  : PBKDF2-SHA512 password hashing (built-in crypto, no deps)
 * - verifyPassword: constant-time comparison; handles legacy plaintext passwords
 */

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto"

// ── Safe ID generation ──────────────────────────────────────────────────────

/**
 * Returns the next sequential ID without using Math.max(...array) spread,
 * which throws RangeError when the array is very large.
 */
export function nextId(existingIds: string[], prefix: string, padding = 2): string {
  const prefixDash = `${prefix}-`
  let max = 0
  for (const id of existingIds) {
    if (!id.startsWith(prefixDash)) continue
    const n = parseInt(id.slice(prefixDash.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefixDash}${String(max + 1).padStart(padding, "0")}`
}

// ── Password hashing ────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEYLEN     = 64
const PBKDF2_DIGEST     = "sha512"

/**
 * Hash a password using PBKDF2-SHA512 with a random salt.
 * Returns a self-contained string: "pbkdf2:<iterations>:<salt>:<hash>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex")
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`
}

/**
 * Verify a password against a stored hash.
 * Accepts both pbkdf2 hashes and legacy plaintext values so that existing
 * accounts continue to work until their password is next set/changed.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false

  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":")
    if (parts.length !== 4) return false
    const [, rawIter, salt, expectedHex] = parts
    const iterations = parseInt(rawIter, 10)
    if (isNaN(iterations) || iterations < 1) return false
    try {
      const actualBuf   = pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST)
      const expectedBuf = Buffer.from(expectedHex, "hex")
      if (actualBuf.length !== expectedBuf.length) return false
      return timingSafeEqual(actualBuf, expectedBuf)
    } catch {
      return false
    }
  }

  // Legacy plaintext — timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(stored), Buffer.from(password))
  } catch {
    return false
  }
}
