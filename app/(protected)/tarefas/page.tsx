export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { checkIsAdmin } from "@/lib/session"
import { redirect } from "next/navigation"
import { TarefasData } from "./TarefasData"

function pickParam(v: string | string[] | undefined): string {
  if (v == null) return ""
  return (Array.isArray(v) ? v[0] : v).trim()
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; assignee?: string | string[] }>
}) {
  const [session, isAdmin, sp] = await Promise.all([auth(), checkIsAdmin(), searchParams])
  if (!isAdmin) redirect("/dashboard")
  const userId = session?.user?.id

  if (!userId) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Não foi possível identificar o usuário autenticado para consultar o Jira.
      </div>
    )
  }

  const urlStatus = pickParam(sp.status)
  const urlAssignee = pickParam(sp.assignee)
  /** Força remontagem do segmento dinâmico quando só a query string muda (filtros). */
  const suspenseKey = `${encodeURIComponent(urlStatus)}|${encodeURIComponent(urlAssignee)}`

  return (
    <Suspense
      key={suspenseKey}
      fallback={
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl bg-surface-card p-8 text-sm text-text-secondary shadow-card">
          <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <span>Carregando tarefas…</span>
        </div>
      }
    >
      <TarefasData userId={userId} urlStatus={urlStatus} urlAssignee={urlAssignee} />
    </Suspense>
  )
}
