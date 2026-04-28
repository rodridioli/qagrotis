import { getLayoutMenuData } from "@/lib/layout-cache"
import { checkIsAdmin } from "@/lib/session"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let hasSistemaComModulo = false
  let isAdmin = false
  try {
    const [rData, rAdmin] = await Promise.allSettled([getLayoutMenuData(), checkIsAdmin()])
    if (rData.status === "fulfilled") {
      const data = rData.value
      sistemaNames = data.sistemaNames
      activeIntegracoes = data.activeIntegracoes
      hasSistemaComModulo = data.hasSistemaComModulo
    }
    if (rAdmin.status === "fulfilled") {
      isAdmin = rAdmin.value
    }
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }
  return (
    <LayoutClient
      sistemaNames={sistemaNames}
      integracoes={activeIntegracoes}
      hasSistemaComModulo={hasSistemaComModulo}
      isAdmin={isAdmin}
    >
      {children}
    </LayoutClient>
  )
}
