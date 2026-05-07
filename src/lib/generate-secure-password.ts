/** Senha forte para cadastro (12 caracteres, mistura de classes). */
export function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digits = "23456789"
  const special = "!@#$%&*"
  const all = upper + lower + digits + special
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  const chars = [
    upper[arr[0] % upper.length],
    upper[arr[1] % upper.length],
    lower[arr[2] % lower.length],
    lower[arr[3] % lower.length],
    digits[arr[4] % digits.length],
    digits[arr[5] % digits.length],
    special[arr[6] % special.length],
    special[arr[7] % special.length],
    all[arr[8] % all.length],
    all[arr[9] % all.length],
    all[arr[10] % all.length],
    all[arr[11] % all.length],
  ]
  const shuffleArr = new Uint8Array(chars.length)
  crypto.getRandomValues(shuffleArr)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleArr[i]! % (i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }
  return chars.join("")
}
