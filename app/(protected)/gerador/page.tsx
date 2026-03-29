import { GeradorClient } from "./GeradorClient"
import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"

export default async function GeradorPage() {
  const [cenarios, modulos] = await Promise.all([getCenarios(), getModulos()])
  return <GeradorClient initialCenarios={cenarios} allModulos={modulos} />
}
