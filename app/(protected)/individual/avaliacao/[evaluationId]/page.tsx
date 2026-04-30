export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"
import { ensureIndividualPerformanceEvaluationTable } from "@/lib/prisma-schema-ensure"
import { IndividualSectionTabs } from "@/components/individual/IndividualSectionTabs"
import { IndividualPerformanceEvaluationForm } from "@/components/individual/IndividualPerformanceEvaluationForm"
import { serializeRscProps } from "@/lib/rsc-serialize"

export const metadata = { title: "Avaliação de desempenho" }

export default async function IndividualAvaliacaoEditPage({
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
  if (!can(role, "individual.viewOthers") || session.user.type !== "Administrador") {
    redirect("/dashboard")
  }

  const { evaluationId } = await params
  const { userId } = await searchParams

  try {
    await ensureIndividualPerformanceEvaluationTable()
  } catch {
    /* opcional */
  }

  let detail: Awaited<ReturnType<typeof getIndividualPerformanceEvaluation>> = null
  try {
    detail = await getIndividualPerformanceEvaluation(evaluationId)
  } catch {
    redirect("/dashboard")
  }

  if (!detail) notFound()

  if (!userId || userId !== detail.evaluatedUserId) {
    redirect(
      `/individual/avaliacao/${encodeURIComponent(evaluationId)}?userId=${encodeURIComponent(detail.evaluatedUserId)}`,
    )
  }

  const querySuffix = `?userId=${encodeURIComponent(detail.evaluatedUserId)}`

  return (
    <div className="space-y-4">
      <IndividualSectionTabs querySuffix={querySuffix} />
      <IndividualPerformanceEvaluationForm
        detail={serializeRscProps(detail)}
        queryUserId={userId}
      />
    </div>
  )
}
