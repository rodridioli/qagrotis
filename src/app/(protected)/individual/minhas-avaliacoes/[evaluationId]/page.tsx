export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getMyCompletedEvaluation } from "@/features/individual/actions/individual-performance-evaluations"
import { getQaUserProfile } from "@/features/usuarios/actions/usuarios"
import { evaluationDisplayCodigo } from "@/features/individual/lib/individual-performance-evaluation"
import { IndividualPerformanceEvaluationPageClient } from "@/features/individual/components/IndividualPerformanceEvaluationPageClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evaluationId: string }>
}) {
  const { evaluationId } = await params
  const session = await auth()
  if (!session?.user) return { title: "Avaliação" }
  const d = await getMyCompletedEvaluation(evaluationId)
  if (!d) return { title: "Avaliação" }
  return { title: `Avaliação — ${evaluationDisplayCodigo(d.codigo)}` }
}

export default async function MinhaAvaliacaoDetailPage({
  params,
}: {
  params: Promise<{ evaluationId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  // MGR acessa via /individual/avaliacoes/[id]; esta rota é exclusiva do avaliado.
  if (can(role, "individual.viewOthers")) {
    redirect("/individual/avaliacoes")
  }

  const { evaluationId } = await params
  const detail = await getMyCompletedEvaluation(evaluationId)
  if (!detail) notFound()

  const profile = await getQaUserProfile(session.user.id)

  return (
    <IndividualPerformanceEvaluationPageClient
      evaluatedUserId={detail.evaluatedUserId}
      evaluatedUser={{
        name: profile?.name?.trim() || session.user.name || session.user.email || "—",
        photoPath: profile?.photoPath ?? null,
        email: profile?.email ?? session.user.email ?? null,
      }}
      initialDetail={detail}
      backHref="/individual/avaliacoes"
    />
  )
}
