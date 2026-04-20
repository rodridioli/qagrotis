export const dynamic = "force-dynamic"

import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { getQaUsers } from "@/lib/actions/usuarios"
import { getSuitesParaDashboard } from "@/lib/actions/suites"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import { DashboardClient } from "./DashboardClient"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { QaUserRecord } from "@/lib/actions/usuarios"
import type { SuiteDashboardRecord } from "@/lib/actions/suites"

export default async function DashboardPage() {
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
