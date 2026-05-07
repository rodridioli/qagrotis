export const dynamic = "force-dynamic"
export const metadata = { title: "Gerador" }

import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { getModulos } from "@/features/qa/actions/modulos"
import { getIntegracoes } from "@/features/integracoes/actions/integracoes"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { IntegracaoRecord } from "@/features/integracoes/actions/integracoes"

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
