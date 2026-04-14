import { getLayoutMenuData } from "@/lib/layout-cache"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemaNames: string[] = []
  let activeIntegracoes: Awaited<ReturnType<typeof getLayoutMenuData>>["activeIntegracoes"] = []
  let sistemaComModulo: string[] = []
  let sistemaComCenario: string[] = []

  try {
    const data = await getLayoutMenuData()
    sistemaNames = data.sistemaNames
    activeIntegracoes = data.activeIntegracoes
    sistemaComModulo = data.sistemaComModulo
    sistemaComCenario = data.sistemaComCenario
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }

  return (
    <LayoutClient
      sistemaNames={sistemaNames}
      integracoes={activeIntegracoes}
      sistemaComModulo={sistemaComModulo}
      sistemaComCenario={sistemaComCenario}
    >
      {children}
    </LayoutClient>
  )
}
