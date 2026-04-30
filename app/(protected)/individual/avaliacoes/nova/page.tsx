export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { createDraftIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"

export const metadata = { title: "Nova avaliação" }

export default async function NovaIndividualAvaliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) redirect("/dashboard")

  const { userId } = await searchParams
  if (!userId) redirect("/individual/ficha")

  const res = await createDraftIndividualPerformanceEvaluation(userId)
  if ("error" in res) {
    redirect(`/individual/avaliacoes?userId=${encodeURIComponent(userId)}`)
  }

  redirect(`/individual/avaliacoes/${res.id}?userId=${encodeURIComponent(userId)}`)
}
