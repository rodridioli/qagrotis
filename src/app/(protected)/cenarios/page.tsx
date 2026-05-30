export const dynamic = "force-dynamic"
export const metadata = { title: "Cenários" }

import { getCenarios } from "@/features/qa/actions/cenarios"
import { getModulos } from "@/features/qa/actions/modulos"
import { getClientes } from "@/features/qa/actions/clientes"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import { checkIsAdmin } from "@/core/session"
import CenariosClient from "./CenariosClient"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { ClienteRecord } from "@/features/qa/actions/clientes"

export default async function CenariosPage() {
  const [isAdmin, { cenarios, modulos, clientes }] = await Promise.all([
    checkIsAdmin(),
    loadParallelOrFallback<{
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
    ),
  ])
  return (
    <CenariosClient
      initialCenarios={serializeRscProps(cenarios)}
      allModulos={serializeRscProps(modulos.filter((m) => m.active))}
      initialClientes={serializeRscProps(clientes.filter((c) => c.active))}
      isAdmin={isAdmin}
    />
  )
}
