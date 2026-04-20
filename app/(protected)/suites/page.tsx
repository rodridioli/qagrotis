export const dynamic = "force-dynamic"

import { getModulos } from "@/lib/actions/modulos"
import { getSuites } from "@/lib/actions/suites"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import SuitesClient from "./SuitesClient"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { SuiteListRecord } from "@/lib/actions/suites"

export default async function SuitesPage() {
  const { modulos, suites } = await loadParallelOrFallback<{
    modulos: ModuloRecord[]
    suites: SuiteListRecord[]
  }>(
    "suites",
    {
      modulos: () => getModulos(),
      suites: () => getSuites(),
    },
    { modulos: [], suites: [] },
  )
  return (
    <SuitesClient
      allModulos={serializeRscProps(modulos.filter((m) => m.active))}
      suites={serializeRscProps(suites)}
    />
  )
}
