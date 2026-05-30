export const dynamic = "force-dynamic"
export const metadata = { title: "Individual" }

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"

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
  // A página de entrada redireciona para "ficha", que é individual-only.
  // Apenas MGR (individual.viewOthers) pode abrir a ficha de outro usuário.
  const canSeeOtherUsers = canViewOthers
  const { userId: requestedUserId } = await searchParams

  if (!canSeeOtherUsers && requestedUserId) {
    redirect("/individual/ficha")
  }

  let activeUsers: Awaited<ReturnType<typeof getActiveQaUsers>> = []
  if (canViewOthers) {
    activeUsers = (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }

  let querySuffix = ""
  if (canSeeOtherUsers && activeUsers.length > 0) {
    const ids = new Set(activeUsers.map((u) => u.id))
    if (!requestedUserId || !ids.has(requestedUserId)) {
      const defaultId = ids.has(session.user.id) ? session.user.id : activeUsers[0].id
      redirect(`/individual/ficha?userId=${encodeURIComponent(defaultId)}`)
    }
    querySuffix = `?userId=${encodeURIComponent(requestedUserId)}`
  } else if (canSeeOtherUsers && requestedUserId) {
    redirect("/individual/ficha")
  }

  redirect(`/individual/ficha${querySuffix}`)
}
