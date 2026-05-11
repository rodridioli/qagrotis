export const dynamic = "force-dynamic"
export const metadata = { title: "Novo cenário" }

import { getModulos } from "@/features/qa/actions/modulos"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { getClientes } from "@/features/qa/actions/clientes"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { getCredenciais } from "@/features/qa/actions/credenciais"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import NovoCenarioClient from "./NovoCenarioClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { SistemaRecord } from "@/features/qa/actions/sistemas"
import type { ClienteRecord } from "@/features/qa/actions/clientes"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { CredencialRecord } from "@/features/qa/actions/credenciais"

export default async function NovoCenarioPage() {
  const { modulos, sistemas, clientes, cenarios, credenciais } = await loadParallelOrFallback<{
    modulos: ModuloRecord[]
    sistemas: SistemaRecord[]
    clientes: ClienteRecord[]
    cenarios: CenarioRecord[]
    credenciais: CredencialRecord[]
  }>(
    "cenarios/novo",
    {
      modulos: () => getModulos(),
      sistemas: () => getSistemas(),
      clientes: () => getClientes(),
      cenarios: () => getCenarios(),
      credenciais: () => getCredenciais(),
    },
    { modulos: [], sistemas: [], clientes: [], cenarios: [], credenciais: [] },
  )
  return (
    <NovoCenarioClient
      initialModulos={serializeRscProps(modulos.filter((m) => m.active))}
      allSistemas={serializeRscProps(sistemas.filter((s) => s.active))}
      initialClientes={serializeRscProps(clientes.filter((c) => c.active))}
      allCenarios={serializeRscProps(cenarios.filter((c) => c.active))}
      initialCredenciais={serializeRscProps(credenciais)}
    />
  )
}
