import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getIntegracoes } from "@/lib/actions/integracoes"

export default async function GeradorPage() {
  const [cenarios, modulos, integracoes] = await Promise.all([getCenarios(), getModulos(), getIntegracoes()])
  return <GeradorClient initialCenarios={cenarios} allModulos={modulos} integracoes={integracoes.filter((i) => i.active)} />
}
