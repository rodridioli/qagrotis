export const dynamic = "force-dynamic"

import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { getQaUsers } from "@/lib/actions/usuarios"
import { getSuitesParaDashboard } from "@/lib/actions/suites"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const [modulos, cenarios, users, suites] = await Promise.all([
    getModulos(),
    getCenarios(),
    getQaUsers(),
    getSuitesParaDashboard(),
  ])
  return (
    <DashboardClient
      allCenarios={cenarios}
      allModulos={modulos}
      allUsers={users}
      allSuites={suites}
    />
  )
}
