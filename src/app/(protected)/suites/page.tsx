export const dynamic = "force-dynamic"
export const metadata = { title: "Suítes" }

import { getModulos } from "@/features/qa/actions/modulos"
import { getSuites } from "@/features/qa/actions/suites"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import { checkIsAdmin, checkCanHardDelete } from "@/core/session"
import SuitesClient from "./SuitesClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { SuiteListRecord } from "@/features/qa/actions/suites"

export default async function SuitesPage() {
  const [isAdmin, canHardDelete, { modulos, suites }] = await Promise.all([
    checkIsAdmin(),
    checkCanHardDelete(),
    loadParallelOrFallback<{
      modulos: ModuloRecord[]
      suites: SuiteListRecord[]
    }>(
      "suites",
      {
        modulos: () => getModulos(),
        suites: () => getSuites(),
      },
      { modulos: [], suites: [] },
    ),
  ])
  return (
    <SuitesClient
      allModulos={serializeRscProps(modulos.filter((m) => m.active))}
      suites={serializeRscProps(suites)}
      isAdmin={isAdmin}
      canHardDelete={canHardDelete}
    />
  )
}
