export const dynamic = "force-dynamic"
export const metadata = { title: "Suítes" }

import { getModulos } from "@/actions/modulos"
import { getSuites } from "@/actions/suites"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import SuitesClient from "./SuitesClient"
import type { ModuloRecord } from "@/actions/modulos"
import type { SuiteListRecord } from "@/actions/suites"

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
