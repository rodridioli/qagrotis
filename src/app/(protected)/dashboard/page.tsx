export const dynamic = "force-dynamic"
export const metadata = { title: "Painel" }

import { redirect } from "next/navigation"
import { getModulos } from "@/features/qa/actions/modulos"
import { getCenarios } from "@/features/qa/actions/cenarios"
import { getQaUsers } from "@/features/usuarios/actions/usuarios"
import { getSuitesParaDashboard } from "@/features/qa/actions/suites"
import { loadParallelOrFallback } from "@/core/safe-server-data"
import { serializeRscProps } from "@/core/rsc-serialize"
import { auth } from "@/core/auth"
import { buildRole } from "@/core/rbac/policy"
import { DashboardClient } from "./DashboardClient"
import { UxDashboardClient } from "./UxDashboardClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { QaUserRecord } from "@/features/usuarios/actions/usuarios"
import type { SuiteDashboardRecord } from "@/features/qa/actions/suites"
import { getEquipeMembrosParaLancamentos } from "@/features/equipe/actions/equipe"
import { getValorHoraAtualBatch } from "@/features/individual/actions/individual-progressao"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const accessProfile = session?.user?.accessProfile ?? "QA"
  const role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const isMgr = role === "Administrador:MGR"
  const perfil = typeof params?.perfil === "string" ? params.perfil : null

  // ── UX dashboard — apenas Administrador:MGR ──────────────────────────────
  if (perfil === "UX") {
    if (!isMgr) redirect("/dashboard")

    const membros = await getEquipeMembrosParaLancamentos("UX")
    const valorHoraMap = await getValorHoraAtualBatch(membros.map((m) => m.userId))

    return (
      <UxDashboardClient
        membros={serializeRscProps(membros)}
        valorHoraMap={serializeRscProps(valorHoraMap)}
      />
    )
  }

  // ── QA dashboard ─────────────────────────────────────────────────────────
  if (accessProfile !== "QA") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-base text-text-secondary">Em desenvolvimento.</p>
      </div>
    )
  }

  const { modulos, cenarios, users, suites } = await loadParallelOrFallback<{
    modulos: ModuloRecord[]
    cenarios: CenarioRecord[]
    users: QaUserRecord[]
    suites: SuiteDashboardRecord[]
  }>(
    "dashboard",
    {
      modulos: () => getModulos(),
      cenarios: () => getCenarios(),
      users: () => getQaUsers(),
      suites: () => getSuitesParaDashboard(),
    },
    { modulos: [], cenarios: [], users: [], suites: [] },
  )
  return (
    <DashboardClient
      allCenarios={serializeRscProps(cenarios)}
      allModulos={serializeRscProps(modulos)}
      allUsers={serializeRscProps(users)}
      allSuites={serializeRscProps(suites)}
    />
  )
}
