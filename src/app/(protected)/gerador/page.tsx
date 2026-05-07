export const dynamic = "force-dynamic"
export const metadata = { title: "Gerador" }

import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/actions/cenarios"
import { getModulos } from "@/actions/modulos"
import { getIntegracoes } from "@/actions/integracoes"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import type { CenarioRecord } from "@/actions/cenarios"
import type { ModuloRecord } from "@/actions/modulos"
import type { IntegracaoRecord } from "@/actions/integracoes"

export default async function GeradorPage() {
  const { cenarios, modulos, integracoes } = await loadParallelOrFallback<{
    cenarios: CenarioRecord[]
    modulos: ModuloRecord[]
    integracoes: IntegracaoRecord[]
  }>(
    "gerador",
    {
      cenarios: () => getCenarios(),
      modulos: () => getModulos(),
      integracoes: () => getIntegracoes(),
    },
    { cenarios: [], modulos: [], integracoes: [] },
  )
  const integracoesSafe = integracoes
    .filter((i) => i.active)
    .map((i) => ({ ...i, apiKey: "" }))
  return (
    <GeradorClient
      initialCenarios={serializeRscProps(cenarios)}
      allModulos={serializeRscProps(modulos)}
      integracoes={serializeRscProps(integracoesSafe)}
    />
  )
}
