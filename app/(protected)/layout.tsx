import { getLayoutMenuData } from "@/lib/layout-cache"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let hasSistemaComModulo = false
  try {
    const data = await getLayoutMenuData()
    sistemaNames = data.sistemaNames
    activeIntegracoes = data.activeIntegracoes
    hasSistemaComModulo = data.hasSistemaComModulo
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }
  return (
    <LayoutClient
      sistemaNames={sistemaNames}
      integracoes={activeIntegracoes}
      hasSistemaComModulo={hasSistemaComModulo}
    >
      {children}
    </LayoutClient>
  )
}
