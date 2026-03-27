import { getModulos } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import { getClientes } from "@/lib/actions/clientes"
import { getCenarios } from "@/lib/actions/cenarios"
import NovoCenarioClient from "./NovoCenarioClient"

export default async function NovoCenarioPage() {
  const [modulos, sistemas, clientes, cenarios] = await Promise.all([
    getModulos(),
    getSistemas(),
    getClientes(),
    getCenarios(),
  ])
  return (
    <NovoCenarioClient
      initialModulos={modulos.filter((m) => m.active)}
      allSistemas={sistemas.filter((s) => s.active)}
      initialClientes={clientes.filter((c) => c.active)}
      allCenarios={cenarios.filter((c) => c.active)}
    />
  )
}
