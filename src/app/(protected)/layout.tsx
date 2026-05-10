import { getLayoutMenuData } from "@/core/layout-cache"
import { checkIsAdmin } from "@/core/session"
import { checkAndSendBirthdayNotifications } from "@/core/actions/notifications"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let hasSistemaComModulo = false
  let hasCenario = false
  let isAdmin = false
  try {
    const [rData, rAdmin] = await Promise.allSettled([getLayoutMenuData(), checkIsAdmin()])
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
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }

  // Dispara verificação de aniversários sem bloquear o render
  void checkAndSendBirthdayNotifications()

  return (
    <LayoutClient
      sistemaNames={sistemaNames}
      integracoes={activeIntegracoes}
      hasSistemaComModulo={hasSistemaComModulo}
      hasCenario={hasCenario}
      isAdmin={isAdmin}
    >
      {children}
    </LayoutClient>
  )
}
