/**
 * URLs de foto no JWT/cookie de sessão precisam ser curtas; `data:` base64
 * (upload de avatar) pode ter MB e quebra o callback OAuth (500).
 */
const MAX_JWT_PHOTO_CHARS = 1800

export function photoPathForJwtCookie(
  p: string | null | undefined,
): string | null {
  if (!p || typeof p !== "string") return null
  const t = p.trim()
  if (!t) return null
  if (t.startsWith("data:")) return null
  if (t.length > MAX_JWT_PHOTO_CHARS) return null
  return t
}
