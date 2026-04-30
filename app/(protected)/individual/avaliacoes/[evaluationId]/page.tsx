export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"
import { getIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"
import { IndividualPerformanceEvaluationPageClient } from "@/components/individual/IndividualPerformanceEvaluationPageClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ evaluationId: string }>
}) {
  const { evaluationId } = await params
  const session = await auth()
  if (!session?.user) return { title: "Avaliação" }
  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) return { title: "Avaliação" }
  const d = await getIndividualPerformanceEvaluation(evaluationId)
  if (!d) return { title: "Avaliação" }
  return { title: `Avaliação — Código ${d.codigo}` }
}

export default async function IndividualAvaliacaoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evaluationId: string }>
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")
  if (!can(role, "individual.viewOthers")) redirect("/dashboard")

  const { evaluationId } = await params
  const { userId: requestedUserId } = await searchParams

  const detail = await getIndividualPerformanceEvaluation(evaluationId)
  if (!detail) notFound()

  if (!requestedUserId || requestedUserId !== detail.evaluatedUserId) {
    redirect(
      `/individual/avaliacoes/${evaluationId}?userId=${encodeURIComponent(detail.evaluatedUserId)}`,
    )
  }

  const activeUsers = (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  const u = activeUsers.find((x) => x.id === detail.evaluatedUserId)
  if (!u) notFound()

  return (
    <IndividualPerformanceEvaluationPageClient
      evaluatedUserId={detail.evaluatedUserId}
      evaluatedUser={{ name: u.name, photoPath: u.photoPath, email: u.email }}
      initialDetail={detail}
    />
  )
}
