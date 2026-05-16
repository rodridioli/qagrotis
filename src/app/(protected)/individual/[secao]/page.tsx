export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getActiveQaUsers } from "@/features/usuarios/actions/usuarios"
import { serializeRscProps } from "@/core/rsc-serialize"
import { IndividualSecaoDevelopmentPanel } from "../IndividualSecaoDevelopmentPanel"
import { MinhasAvaliacoesSection } from "@/features/individual/components/MinhasAvaliacoesSection"
import { MinhasFeedbacksSection } from "@/features/individual/components/MinhasFeedbacksSection"
import { ConquistasSection } from "@/features/individual/components/ConquistasSection"
import { MinhasProgressoesSection } from "@/features/individual/components/MinhasProgressoesSection"
import { IndividualLancamentosSection } from "@/features/individual/components/IndividualLancamentosSection"
import { IndividualFeriasSection } from "@/features/individual/components/IndividualFeriasSection"
import { individualSectionLabel, isIndividualSectionSlug } from "@/features/individual/lib/individual-sections"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ secao: string }>
}) {
  const { secao } = await params
  const label = isIndividualSectionSlug(secao) ? individualSectionLabel(secao) : undefined
  return { title: label ? `Individual — ${label}` : "Individual" }
}

export default async function IndividualSecaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string }>
  searchParams: Promise<{ userId?: string; completed?: string }>
}) {
  const { secao } = await params
  if (!isIndividualSectionSlug(secao)) notFound()

  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.individual")) redirect("/dashboard")

  if (secao === "lancamentos") notFound()

  const canAccessLancamentos = false
  const canViewOthers = can(role, "individual.viewOthers")
  const { userId: requestedUserId, completed } = await searchParams
  const showCompletedToast = completed === "1"
  
  if (!canViewOthers && requestedUserId) {
    redirect(`/individual/${secao}`)
  }

  const activeUsers = canViewOthers
    ? (await getActiveQaUsers()).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : []

  let targetUserId = session.user.id

  if (canViewOthers && activeUsers.length > 0) {
    const ids = new Set(activeUsers.map((u) => u.id))
    if (!requestedUserId || !ids.has(requestedUserId)) {
      redirect(`/individual/${secao}?userId=${encodeURIComponent(activeUsers[0].id)}`)
    }
    targetUserId = requestedUserId
  } else if (canViewOthers && activeUsers.length === 0 && requestedUserId) {
    redirect(`/individual/${secao}`)
  }

  const showMgrUserFilter = canViewOthers && activeUsers.length > 0
  const isAdministradorMgr =
    session.user.type === "Administrador" && session.user.accessProfile === "MGR"

  const avatarUsers = serializeRscProps(
    activeUsers.map((u) => ({ id: u.id, name: u.name, photoPath: u.photoPath, email: u.email, accessProfile: u.accessProfile ?? null })),
  )

  return (
    <div className="space-y-4">
      {showMgrUserFilter ? (
        <IndividualSecaoDevelopmentPanel
          secao={secao}
          users={avatarUsers}
          selectedUserId={targetUserId}
          isAdministradorMgr={isAdministradorMgr}
          canAccessLancamentos={canAccessLancamentos}
          showCompletedToast={showCompletedToast}
        />
      ) : secao === "avaliacoes" ? (
        <MinhasAvaliacoesSection showCompletedToast={showCompletedToast} />
      ) : secao === "feedbacks" ? (
        <MinhasFeedbacksSection showCompletedToast={showCompletedToast} />
      ) : secao === "conquistas" ? (
        <ConquistasSection />
      ) : secao === "progressao" ? (
        <MinhasProgressoesSection />
      ) : secao === "ferias" ? (
        <IndividualFeriasSection evaluatedUserId={session.user.id} canWrite={false} defaultSituacaoFiltro="todas" />
      ) : secao === "lancamentos" ? (
        <IndividualLancamentosSection evaluatedUserId={session.user.id} />
      ) : (
        <div className="flex min-h-[min(70vh,36rem)] w-full flex-col items-center justify-center py-16">
          <p className="text-center text-base text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
