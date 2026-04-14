import { getSistemas } from "@/lib/actions/sistemas"

// Always fetch fresh — prevents stale cache from delivering empty sistemaNames to LayoutClient
export const dynamic = "force-dynamic"
import { getIntegracoes } from "@/lib/actions/integracoes"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemas: Awaited<ReturnType<typeof getSistemas>> = []
  let integracoes: Awaited<ReturnType<typeof getIntegracoes>> = []
  let modulos: Awaited<ReturnType<typeof getModulos>> = []
  let cenarios: Awaited<ReturnType<typeof getCenarios>> = []
  try {
    ;[sistemas, integracoes, modulos, cenarios] = await Promise.all([
      getSistemas(),
      getIntegracoes(),
      getModulos(),
      getCenarios(),
    ])
  } catch {
    // If DB is temporarily unavailable, render layout without lists
  }

  const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
  const activeIntegracoes = integracoes.filter((i) => i.active)

  // Sistemas que têm pelo menos 1 módulo ativo
  const sistemaComModulo = [
    ...new Set(modulos.filter((m) => m.active).map((m) => m.sistemaName)),
  ]

  // Sistemas que têm pelo menos 1 cenário ativo
  const sistemaComCenario = [
    ...new Set(cenarios.filter((c) => c.active).map((c) => c.system)),
  ]

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
