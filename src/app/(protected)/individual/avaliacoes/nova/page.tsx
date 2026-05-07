export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/actions/usuarios"
import { IndividualPerformanceEvaluationPageClient } from "@/components/individual/IndividualPerformanceEvaluationPageClient"

export const metadata = { title: "Nova avaliação" }

export default async function NovaIndividualAvaliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")
  if (!can(role, "individual.viewOthers")) redirect("/dashboard")

  const { userId } = await searchParams
  if (!userId?.trim()) redirect("/individual/ficha")

  const activeUsers = await getActiveQaUsers()
  const u = activeUsers.find((x) => x.id === userId)
  if (!u) redirect(`/individual/avaliacoes?userId=${encodeURIComponent(userId ?? "")}`)

  // Compute today's date server-side so the form shows the correct date
  const now = new Date()
  const todayYmd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`

  return (
    <IndividualPerformanceEvaluationPageClient
      evaluatedUserId={userId!}
      evaluatedUser={{ name: u.name, photoPath: u.photoPath, email: u.email }}
      initialDetail={null}
      todayYmd={todayYmd}
    />
  )
}
