export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

async function NovaSuiteContent({ cenarioIds }: { cenarioIds: string[] }) {
  const [systemList, allModulos, allCenarios] = await Promise.all([
    getActiveSistemaNames(),
    getModulos(),
    getCenarios()
  ])

  const activeModulos = allModulos.filter(m => m.active)

  // Pre-load cenarios from IDs passed via URL
  const preloadedCenarios = cenarioIds.length > 0
    ? allCenarios.filter(c => cenarioIds.includes(c.id))
    : []

  const preloadedSuite = preloadedCenarios.length > 0 ? {
    cenarios: preloadedCenarios.map(c => ({
      id: c.id,
      name: c.scenarioName,
      module: c.module,
      tipo: c.tipo,
      execucoes: 0,
      erros: 0,
    }))
  } : undefined

  return (
    <SuiteForm
      mode="create"
      systemList={systemList}
      initialSistema={systemList[0] ?? ""}
      allModulos={activeModulos}
      allCenarios={allCenarios}
      preloadedSuite={preloadedSuite}
    />
  )
}

export default async function NovaSuitePage({
  searchParams,
}: {
  searchParams: Promise<{ cenarios?: string }>
}) {
  const params = await searchParams
  const cenarioIds = params.cenarios ? params.cenarios.split(",").filter(Boolean) : []

  return (
    <Suspense>
      <NovaSuiteContent cenarioIds={cenarioIds} />
    </Suspense>
  )
}
