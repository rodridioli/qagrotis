/**
 * Alinha colunas críticas com o schema Prisma (ex.: migração não aplicada no build).
 * Corre uma vez por instância Node; falhas são só logadas.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return
  try {
    const { ensureUserDataNascimentoColumns } = await import("@/lib/prisma-schema-ensure")
    await ensureUserDataNascimentoColumns()
  } catch (e) {
    console.error("[instrumentation] register schema ensure", e)
  }
}

/**
 * Registra erros de servidor com o mesmo `digest` que aparece no cliente,
 * para correlacionar em Runtime Logs na Vercel (busque pelo número ou por [server-error]).
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function onRequestError(
  error: Error & { digest?: string },
  request: {
    path: string
    method: string
    headers: { [key: string]: string | string[] | undefined }
  },
  context: {
    routerKind?: string
    routePath?: string
    routeType?: string
    renderSource?: string
    [key: string]: unknown
  },
): Promise<void> {
  const digest = error.digest
  console.error("[server-error]", {
    digest,
    message: error.message,
    name: error.name,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    stack: error.stack?.split("\n").slice(0, 12).join("\n"),
  })
}
