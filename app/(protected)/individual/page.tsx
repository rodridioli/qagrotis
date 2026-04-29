export const dynamic = "force-dynamic"
export const metadata = { title: "Individual" }

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"

export default async function IndividualPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  const canViewOthers = can(role, "individual.viewOthers")
  const { userId: requestedUserId } = await searchParams

  if (!canViewOthers && requestedUserId) {
    redirect("/individual/ficha")
  }

  const activeUsers = canViewOthers
    ? (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : []

  let querySuffix = ""
  if (canViewOthers && activeUsers.length > 0) {
    const ids = new Set(activeUsers.map((u) => u.id))
    if (!requestedUserId || !ids.has(requestedUserId)) {
      redirect(`/individual/ficha?userId=${encodeURIComponent(activeUsers[0].id)}`)
    }
    querySuffix = `?userId=${encodeURIComponent(requestedUserId)}`
  } else if (canViewOthers && requestedUserId) {
    redirect("/individual/ficha")
  }

  redirect(`/individual/ficha${querySuffix}`)
}
