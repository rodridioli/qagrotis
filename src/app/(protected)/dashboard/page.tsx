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
import { TwDashboardClient } from "./TwDashboardClient"
import { QaDashboardClient } from "./QaDashboardClient"
import type { ModuloRecord } from "@/features/qa/actions/modulos"
import type { CenarioRecord } from "@/features/qa/actions/cenarios"
import type { QaUserRecord } from "@/features/usuarios/actions/usuarios"
import type { SuiteDashboardRecord } from "@/features/qa/actions/suites"
import { getEquipeMembrosParaLancamentos, getEquipeMembrosParaLancamentosComInativos } from "@/features/equipe/actions/equipe"
import { getProgressaoHistoricoBatch } from "@/features/individual/actions/individual-progressao"
import { getApprovalIssuesByTag, getUxMemberJiraIds } from "@/features/qa/actions/jira-worklog-cache"

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

  // ── UX (Padrão ou Administrador) → Kanban é a home ─────────────────────
  if (accessProfile === "UX") redirect("/kanban")

  // ── TW (Padrão ou Administrador) → Registros é a home ──────────────────
  if (accessProfile === "TW") {
    if (role === "Administrador:TW") redirect("/equipe?tab=lancamentos")
    redirect("/individual/lancamentos")
  }

  // ── MGR sem perfil → redireciona para visão padrão MGR ─────────────────
  if (isMgr && !perfil) redirect("/dashboard?perfil=MGR")

  // ── UX dashboard — apenas Administrador:MGR ──────────────────────────────
  if (perfil === "UX") {
    if (!isMgr) redirect("/dashboard")

    const membros = await getEquipeMembrosParaLancamentosComInativos("UX")
    const userIds = membros.map((m) => m.userId)
    const [approvalIssues, memberJiraIds, progressaoMap] = await Promise.all([
      getApprovalIssuesByTag("UX"),
      getUxMemberJiraIds(userIds),
      getProgressaoHistoricoBatch(userIds),
    ])

    return (
      <UxDashboardClient
        membros={serializeRscProps(membros)}
        progressaoMap={serializeRscProps(progressaoMap)}
        approvalIssues={approvalIssues}
        memberJiraIds={memberJiraIds}
      />
    )
  }

  // ── QA dashboard — apenas Administrador:MGR ─────────────────────────────
  if (perfil === "QA") {
    if (!isMgr) redirect("/dashboard")

    const membros = await getEquipeMembrosParaLancamentosComInativos("QA")
    const userIds = membros.map((m) => m.userId)
    const progressaoMap = await getProgressaoHistoricoBatch(userIds)

    const rawBrokenTypes = process.env.JIRA_BROKEN_TEST_ISSUE_TYPES ?? ""
    const brokenTestIssueTypeNames = Array.from(
      new Set(
        rawBrokenTypes
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    )
    if (brokenTestIssueTypeNames.length === 0) brokenTestIssueTypeNames.push("Broken Test")

    return (
      <QaDashboardClient
        membros={serializeRscProps(membros)}
        progressaoMap={serializeRscProps(progressaoMap)}
        brokenTestIssueTypeNames={brokenTestIssueTypeNames}
      />
    )
  }

  // ── TW dashboard — apenas Administrador:MGR ──────────────────────────────
  if (perfil === "TW") {
    if (!isMgr) redirect("/dashboard")

    const membros = await getEquipeMembrosParaLancamentosComInativos("TW")
    const userIds = membros.map((m) => m.userId)
    const [approvalIssues, memberJiraIds, progressaoMap] = await Promise.all([
      getApprovalIssuesByTag("TW"),
      getUxMemberJiraIds(userIds),
      getProgressaoHistoricoBatch(userIds),
    ])

    return (
      <TwDashboardClient
        membros={serializeRscProps(membros)}
        progressaoMap={serializeRscProps(progressaoMap)}
        approvalIssues={approvalIssues}
        memberJiraIds={memberJiraIds}
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
