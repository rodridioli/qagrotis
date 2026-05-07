export const dynamic = "force-dynamic"
export const metadata = { title: "Cenários" }

import { getCenarios } from "@/actions/cenarios"
import { getModulos } from "@/actions/modulos"
import { getClientes } from "@/actions/clientes"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import CenariosClient from "./CenariosClient"
import type { CenarioRecord } from "@/actions/cenarios"
import type { ModuloRecord } from "@/actions/modulos"
import type { ClienteRecord } from "@/actions/clientes"

export default async function CenariosPage() {
  const { cenarios, modulos, clientes } = await loadParallelOrFallback<{
    cenarios: CenarioRecord[]
    modulos: ModuloRecord[]
    clientes: ClienteRecord[]
  }>(
    "cenarios",
    {
      cenarios: () => getCenarios(),
      modulos: () => getModulos(),
      clientes: () => getClientes(),
    },
    { cenarios: [], modulos: [], clientes: [] },
  )
  return (
    <CenariosClient
      initialCenarios={serializeRscProps(cenarios)}
      allModulos={serializeRscProps(modulos.filter((m) => m.active))}
      initialClientes={serializeRscProps(clientes.filter((c) => c.active))}
    />
  )
}
