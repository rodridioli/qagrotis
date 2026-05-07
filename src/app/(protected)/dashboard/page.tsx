export const dynamic = "force-dynamic"
export const metadata = { title: "Painel" }

import { getModulos } from "@/features/qa/actions/modulos"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { getQaUsers } from "@/features/usuarios/actions/usuarios"
import { getSuitesParaDashboard } from "@/features/qa/actions/suites"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import { auth } from "@/core/auth"
import { DashboardClient } from "./DashboardClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { QaUserRecord } from "@/features/usuarios/actions/usuarios"
import type { SuiteDashboardRecord } from "@/features/qa/actions/suites"

export default async function DashboardPage() {
  const session = await auth()
  const accessProfile = session?.user?.accessProfile ?? "QA"

  // Apenas QA tem dashboard implementado; UX/TW/MGR terão dashboards próprios futuramente.
  if (accessProfile !== "QA") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-base text-text-secondary">Em desenvolvimento.</p>
      </div>
    )
  }

  const { modulos, cenarios, users, suites } = await loadParallelOrFallback<{
    modulos: ModuloRecord[]
    cenarios: CenarioRecord[]
    users: QaUserRecord[]
    suites: SuiteDashboardRecord[]
  }>(
    "dashboard",
    {
      modulos: () => getModulos(),
      cenarios: () => getCenarios(),
      users: () => getQaUsers(),
      suites: () => getSuitesParaDashboard(),
    },
    { modulos: [], cenarios: [], users: [], suites: [] },
  )
  return (
    <DashboardClient
      allCenarios={serializeRscProps(cenarios)}
      allModulos={serializeRscProps(modulos)}
      allUsers={serializeRscProps(users)}
      allSuites={serializeRscProps(suites)}
    />
  )
}
