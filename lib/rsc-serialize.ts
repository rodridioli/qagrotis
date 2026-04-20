/**
 * Garante objeto JSON-puro para props Server → Client (Next.js RSC).
 * Evita falhas de serialização com tipos não suportados ou referências estranhas em JSON do Prisma.
 */
function jsonReplacer(_key: string, val: unknown): unknown {
  if (typeof val === "bigint") return val.toString()
  return val
}

export function serializeRscProps<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value, jsonReplacer)) as T
  } catch (e) {
    console.error("[serializeRscProps] falha, usando valor bruto:", e)
    return value
  }
}
