export const dynamic = "force-dynamic"

import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getIntegracoes } from "@/lib/actions/integracoes"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { IntegracaoRecord } from "@/lib/actions/integracoes"

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
  return <GeradorClient initialCenarios={cenarios} allModulos={modulos} integracoes={integracoesSafe} />
}
