/**
 * Shared utilities for the data layer.
 *
 * - nextId        : safe sequential ID generation (e.g. "CT-001", "SIS-01")
 * - hashPassword  : PBKDF2-SHA512 password hashing (built-in crypto, no deps)
 * - verifyPassword: constant-time comparison; handles legacy plaintext passwords
 * - encryptField  : AES-256-GCM symmetric encryption for sensitive DB fields
 * - decryptField  : AES-256-GCM decryption; backward-compatible with plaintext
 */

import { pbkdf2Sync, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto"

// ── Symmetric encryption (AES-256-GCM) ────────────────────────────────────
// Used for reversible sensitive fields (test passwords, API tokens).
// Set ENCRYPTION_KEY to a 64-char hex string (32 bytes).
// If the key is absent the field is stored as-is (backward compatible).
// Encrypted format: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"

const ENC_ALGORITHM = "aes-256-gcm"
const ENC_PREFIX    = "enc:v1:"

function getEncryptionKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, "hex")
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Falls back to storing plain text when ENCRYPTION_KEY is not set.
 */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey()
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[encryptField] ENCRYPTION_KEY não configurada — campo salvo sem criptografia.")
    }
    return plaintext
  }
  const iv       = randomBytes(12)
  const cipher   = createCipheriv(ENC_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag      = cipher.getAuthTag()
  return `${ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/**
 * Decrypts a field produced by encryptField.
 * Returns the value as-is if it was stored without encryption (backward compat).
 */
export function decryptField(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value // plaintext or empty
  const key = getEncryptionKey()
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[decryptField] ENCRYPTION_KEY não configurada — não é possível descriptografar.")
    }
    return value
  }
  try {
    const parts = value.slice(ENC_PREFIX.length).split(":")
    if (parts.length !== 3) return value
    const [ivHex, tagHex, dataHex] = parts
    const iv      = Buffer.from(ivHex,   "hex")
    const tag     = Buffer.from(tagHex,  "hex")
    const data    = Buffer.from(dataHex, "hex")
    const decipher = createDecipheriv(ENC_ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString("utf8") + decipher.final("utf8")
  } catch {
    return value // decryption failure — return ciphertext intact
  }
}

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
