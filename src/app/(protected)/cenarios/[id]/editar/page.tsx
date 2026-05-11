export const metadata = { title: "Editar cenário" }

import { notFound } from "next/navigation"
import { getCenario, getCenarios } from "@/features/qa/actions/cenarios"
import { getModulos } from "@/features/qa/actions/modulos"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { getClientes } from "@/features/qa/actions/clientes"
import { getCredenciais } from "@/features/qa/actions/credenciais"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import EditarCenarioClient from "./EditarCenarioClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { SistemaRecord } from "@/features/qa/actions/sistemas"
import type { ClienteRecord } from "@/features/qa/actions/clientes"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { CredencialRecord } from "@/features/qa/actions/credenciais"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditarCenarioPage({ params }: Props) {
  const { id } = await params

  const [cenario, { modulos, sistemas, clientes, cenarios, credenciais }] = await Promise.all([
    getCenario(id),
    loadParallelOrFallback<{
      modulos: ModuloRecord[]
      sistemas: SistemaRecord[]
      clientes: ClienteRecord[]
      cenarios: CenarioRecord[]
      credenciais: CredencialRecord[]
    }>(
      "cenarios/editar",
      {
        modulos: () => getModulos(),
        sistemas: () => getSistemas(),
        clientes: () => getClientes(),
        cenarios: () => getCenarios(),
        credenciais: () => getCredenciais(),
      },
      { modulos: [], sistemas: [], clientes: [], cenarios: [], credenciais: [] },
    ),
  ])

  if (!cenario) notFound()

  return (
    <EditarCenarioClient
      cenario={cenario}
      initialModulos={serializeRscProps(modulos.filter((m) => m.active))}
      allSistemas={serializeRscProps(sistemas.filter((s) => s.active))}
      initialClientes={serializeRscProps(clientes)}
      allCenarios={serializeRscProps(cenarios.filter((c) => c.active && c.id !== id))}
      initialCredenciais={serializeRscProps(credenciais)}
    />
  )
}
