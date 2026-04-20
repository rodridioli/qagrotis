export const dynamic = "force-dynamic"

import { getCenarios } from "@/lib/actions/cenarios"
import { getModulos } from "@/lib/actions/modulos"
import { getClientes } from "@/lib/actions/clientes"
import { loadParallelOrFallback } from "@/lib/safe-server-data"
import { serializeRscProps } from "@/lib/rsc-serialize"
import CenariosClient from "./CenariosClient"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { ClienteRecord } from "@/lib/actions/clientes"

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
