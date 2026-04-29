export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getQaUsers } from "@/lib/actions/usuarios"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"

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

  let targetUserId = session.user.id
  let targetUserName: string | null = null

  if (requestedUserId && requestedUserId !== session.user.id) {
    if (!canViewOthers) redirect(`/individual/${secao}`)
    targetUserId = requestedUserId
    const users = await getQaUsers()
    targetUserName = users.find((u) => u.id === requestedUserId)?.name ?? requestedUserId
  }

  const isViewingOther = targetUserId !== session.user.id
  const querySuffix = isViewingOther ? `?userId=${encodeURIComponent(targetUserId)}` : ""
  const backHref = `/individual${querySuffix}`

  const breadcrumbItems = [
    { label: "Individual", href: backHref },
    ...(isViewingOther && targetUserName ? [{ label: targetUserName }] : []),
    { label },
  ]

  return (
    <div className="space-y-4">
      <PageBreadcrumb backHref={backHref} items={breadcrumbItems} />

      <div className="flex min-h-[40vh] items-center justify-center rounded-xl bg-surface-card p-12 shadow-card">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">{label}</p>
          <p className="mt-2 text-sm text-text-secondary">Em desenvolvimento</p>
        </div>
      </div>
    </div>
  )
}
