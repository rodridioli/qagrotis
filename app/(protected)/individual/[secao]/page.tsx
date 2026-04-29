export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"
import { serializeRscProps } from "@/lib/rsc-serialize"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { IndividualSecaoDevelopmentPanel } from "../IndividualSecaoDevelopmentPanel"

const SECTION_LABELS: Record<string, string> = {
  dominio: "Domínio",
  avaliacoes: "Avaliações",
  feedbacks: "Feedbacks",
  conquistas: "Conquistas",
  pdi: "PDI",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ secao: string }>
}) {
  const { secao } = await params
  const label = SECTION_LABELS[secao]
  return { title: label ? `Individual — ${label}` : "Individual" }
}

export default async function IndividualSecaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string }>
  searchParams: Promise<{ userId?: string }>
}) {
  const { secao } = await params
  const label = SECTION_LABELS[secao]
  if (!label) notFound()

  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  const canViewOthers = can(role, "individual.viewOthers")
  const { userId: requestedUserId } = await searchParams

  if (!canViewOthers && requestedUserId) {
    redirect(`/individual/${secao}`)
  }

  const activeUsers = canViewOthers
    ? (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : []

  let targetUserId = session.user.id
  let targetUserName: string | null = null

  if (canViewOthers && activeUsers.length > 0) {
    const ids = new Set(activeUsers.map((u) => u.id))
    if (!requestedUserId || !ids.has(requestedUserId)) {
      redirect(`/individual/${secao}?userId=${encodeURIComponent(activeUsers[0].id)}`)
    }
    targetUserId = requestedUserId
    targetUserName = activeUsers.find((u) => u.id === requestedUserId)?.name ?? null
  } else if (canViewOthers && activeUsers.length === 0 && requestedUserId) {
    redirect(`/individual/${secao}`)
  }

  const showMgrUserFilter = canViewOthers && activeUsers.length > 0
  const querySuffix = showMgrUserFilter ? `?userId=${encodeURIComponent(targetUserId)}` : ""
  const backHref = `/individual${querySuffix}`

  const breadcrumbItems = [
    { label: "Individual", href: backHref },
    ...(showMgrUserFilter && targetUserName ? [{ label: targetUserName }] : []),
    { label },
  ]

  const avatarUsers = serializeRscProps(
    activeUsers.map((u) => ({ id: u.id, name: u.name, photoPath: u.photoPath })),
  )

  return (
    <div className="space-y-4">
      <PageBreadcrumb backHref={backHref} items={breadcrumbItems} />

      {showMgrUserFilter ? (
        <IndividualSecaoDevelopmentPanel secao={secao} users={avatarUsers} selectedUserId={targetUserId} />
      ) : (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl bg-surface-card p-12 shadow-card">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
