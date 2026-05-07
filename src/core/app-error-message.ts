/**
 * Em produção o Next.js substitui a mensagem real de falhas em React Server Components
 * por texto genérico em inglês (evita vazar stack interno ao cliente).
 * O campo `digest` continua disponível para correlacionar com logs do servidor (ex.: Vercel).
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export function getAppErrorUserMessage(error: Error & { digest?: string }): string {
  const m = (error.message || "").trim()
  if (
    m.includes("An error occurred in the Server Components render") ||
    m.includes("omitted in production builds") ||
    m.includes("digest property")
  ) {
    const tail = error.digest
      ? ` Nos Runtime Logs da Vercel, busque \`[server-error]\` ou o digest \`${error.digest}\` (mensagem e rota aparecem no servidor).`
      : ""
    return `Erro ao processar esta página no servidor. Em produção o detalhe técnico fica oculto; use o ref abaixo ou reproduza com npm run dev.${tail}`
  }
  return m || "Ocorreu um erro inesperado."
}

/** Log no console do browser (útil com DevTools aberto). */
export function logClientSegmentError(segment: string, error: Error & { digest?: string }): void {
  console.error(`[${segment}]`, error.digest ?? "(sem digest)", error)
}

