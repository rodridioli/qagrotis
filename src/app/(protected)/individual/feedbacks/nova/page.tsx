export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"
import { IndividualFeedbackPageClient } from "@/features/individual/components/IndividualFeedbackPageClient"

export const metadata = { title: "Novo feedback" }

export default async function NovaIndividualFeedbackPage({
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
  if (!u) redirect(`/individual/feedbacks?userId=${encodeURIComponent(userId ?? "")}`)

  const now = new Date()
  const todayYmd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`

  return (
    <IndividualFeedbackPageClient
      evaluatedUserId={userId!}
      evaluatedUser={{ name: u.name, photoPath: u.photoPath, email: u.email }}
      initialDetail={null}
      todayYmd={todayYmd}
    />
  )
}
