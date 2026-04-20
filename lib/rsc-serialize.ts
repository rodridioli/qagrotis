/**
 * Garante objeto JSON-puro para props Server → Client (Next.js RSC).
 * Evita falhas de serialização com tipos não suportados ou referências estranhas em JSON do Prisma.
 */
export function serializeRscProps<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch (e) {
    console.error("[serializeRscProps] falha, usando valor bruto:", e)
    return value
  }
}
