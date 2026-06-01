// All protected routes require session (headers) — force dynamic for the entire tree.
export const dynamic = "force-dynamic"

import { getLayoutMenuData } from "@/core/layout-cache"
import { checkIsAdmin } from "@/core/session"
import { checkAndSendBirthdayNotifications, checkAndSendCompanyAnniversaryNotifications } from "@/core/actions/notifications"
import { getPendingDominioAvaliacao } from "@/features/individual/actions/individual-dominio"
import type { PendingDominioAvaliacaoDto } from "@/features/individual/actions/individual-dominio"
import { auth } from "@/core/auth"
import { buildRole } from "@/core/rbac/policy"
import { getJiraConfiguredStatus, getClockworkConfiguredStatus } from "@/features/integracoes/lib/integration-status"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let hasSistemaComModulo = false
  let hasCenario = false
  let isAdmin = false
  let hasJiraConfigured = false
  let hasClockworkConfigured = false
  let pendingDominioAvaliacao: PendingDominioAvaliacaoDto | null = null
  let userEmail = ""
  try {
    const session = await auth()
    const userId = session?.user?.id ?? ""
    userEmail = session?.user?.email ?? ""
    const role = buildRole(session?.user?.type, session?.user?.accessProfile)
    const isMgr = role === "Administrador:MGR"

    const clockworkTask = isMgr ? getClockworkConfiguredStatus() : Promise.resolve(false)

    const [rData, rAdmin, rDominio, rJira, rClockwork] = await Promise.allSettled([
      getLayoutMenuData(),
      checkIsAdmin(),
      getPendingDominioAvaliacao(),
      userId ? getJiraConfiguredStatus(userId, userEmail) : Promise.resolve(false),
      clockworkTask,
    ])
    if (rData.status === "fulfilled") {
      const data = rData.value
      sistemaNames = data.sistemaNames
      activeIntegracoes = data.activeIntegracoes
      hasSistemaComModulo = data.hasSistemaComModulo
      hasCenario = data.hasCenario
    }
    if (rAdmin.status === "fulfilled") {
      isAdmin = rAdmin.value
    }
    if (rDominio.status === "fulfilled") {
      pendingDominioAvaliacao = rDominio.value
    }
    if (rJira.status === "fulfilled") {
      hasJiraConfigured = rJira.value
    }
    if (rClockwork.status === "fulfilled") {
      hasClockworkConfigured = rClockwork.value
    }
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }

  // Dispara verificação de aniversários sem bloquear o render
  void checkAndSendBirthdayNotifications()
  void checkAndSendCompanyAnniversaryNotifications()

  return (
    <LayoutClient
      sistemaNames={sistemaNames}
      integracoes={activeIntegracoes}
      hasSistemaComModulo={hasSistemaComModulo}
      hasCenario={hasCenario}
      isAdmin={isAdmin}
      hasJiraConfigured={hasJiraConfigured}
      hasClockworkConfigured={hasClockworkConfigured}
      userEmail={userEmail}
      pendingDominioAvaliacao={pendingDominioAvaliacao}
    >
      {children}
    </LayoutClient>
  )
}
