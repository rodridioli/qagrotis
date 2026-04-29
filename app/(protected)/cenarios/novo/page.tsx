export const dynamic = "force-dynamic"
export const metadata = { title: "Novo cenário" }

import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import { getCenarios } from "@/lib/actions/cenarios"
import { getCredenciais } from "@/lib/actions/credenciais"
import NovoCenarioClient from "./NovoCenarioClient"

export default async function NovoCenarioPage() {
  const [modulos, sistemas, clientes, cenarios, credenciais] = await Promise.all([
    getModulos(),
    getSistemas(),
    getClientes(),
    getCenarios(),
    getCredenciais(),
  ])
  return (
    <NovoCenarioClient
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes.filter((c) => c.active)}
      allCenarios={cenarios.filter((c) => c.active)}
      initialCredenciais={credenciais}
    />
  )
}
