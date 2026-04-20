export const dynamic = "force-dynamic"

import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getIntegracoes } from "@/lib/actions/integracoes"

export default async function GeradorPage() {
  const [cenarios, modulos, integracoes] = await Promise.all([getCenarios(), getModulos(), getIntegracoes()])
  const integracoesSafe = integracoes
    .filter((i) => i.active)
    .map((i) => ({ ...i, apiKey: "" }))
  return <GeradorClient initialCenarios={cenarios} allModulos={modulos} integracoes={integracoesSafe} />
}
