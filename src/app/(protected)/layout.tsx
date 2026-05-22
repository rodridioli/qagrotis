// All protected routes require session (headers) — force dynamic for the entire tree.
export const dynamic = "force-dynamic"

import { getLayoutMenuData } from "@/core/layout-cache"
import { checkIsAdmin } from "@/core/session"
import { checkAndSendBirthdayNotifications, checkAndSendCompanyAnniversaryNotifications } from "@/core/actions/notifications"
import { getPendingDominioAvaliacao } from "@/features/individual/actions/individual-dominio"
import type { PendingDominioAvaliacaoDto } from "@/features/individual/actions/individual-dominio"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let hasSistemaComModulo = false
  let hasCenario = false
  let isAdmin = false
  let pendingDominioAvaliacao: PendingDominioAvaliacaoDto | null = null
  try {
    const [rData, rAdmin, rDominio] = await Promise.allSettled([
      getLayoutMenuData(),
      checkIsAdmin(),
      getPendingDominioAvaliacao(),
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
      pendingDominioAvaliacao={pendingDominioAvaliacao}
    >
      {children}
    </LayoutClient>
  )
}
