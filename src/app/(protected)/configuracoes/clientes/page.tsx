export const dynamic = "force-dynamic"
export const metadata = { title: "Clientes" }

import { getClientes } from "@/features/qa/actions/clientes"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { checkIsAdmin } from "@/core/session"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import ClientesClient from "./ClientesClient"
import type { ClienteRecord } from "@/features/qa/actions/clientes"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"

export default async function ClientesPage() {
  const [isAdmin, { clientes, cenarios }] = await Promise.all([
    checkIsAdmin(),
    loadParallelOrFallback<{
      clientes: ClienteRecord[]
      cenarios: CenarioRecord[]
    }>(
      "configuracoes/clientes",
      {
        clientes: () => getClientes(),
        cenarios: () => getCenarios(),
      },
      { clientes: [], cenarios: [] },
    ),
  ])
  return (
    <ClientesClient
      initialClientes={serializeRscProps(clientes)}
      initialCenarios={serializeRscProps(cenarios)}
      isAdmin={isAdmin}
    />
  )
}
