import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getKanbanSubtasks, getUxTarefasForMainKanban } from "@/features/kanban/actions/kanban"
import { getKanbanAssignments, getMainKanbanColumnStates } from "@/features/kanban/actions/ux-kanban"
import { getEquipeMembrosParaLancamentosComInativos } from "@/features/equipe/actions/equipe"
import { serializeRscProps } from "@/core/rsc-serialize"
import { getJiraConfiguredStatus } from "@/features/integracoes/lib/integration-status"
import { IntegrationNotConfiguredCard } from "@/components/shared/IntegrationNotConfiguredCard"
import { UxKanbanClient } from "./UxKanbanClient"

export const dynamic = "force-dynamic"

export default async function KanbanPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) redirect("/dashboard")

  const jiraConfigured = await getJiraConfiguredStatus(session.user.id)
  if (!jiraConfigured) {
    return <IntegrationNotConfiguredCard type="jira" />
  }

  const [result, members, assignments, tarefasResult, columnStateMap] = await Promise.all([
    getKanbanSubtasks(),
    getEquipeMembrosParaLancamentosComInativos("UX"),
    getKanbanAssignments(),
    getUxTarefasForMainKanban(),
    getMainKanbanColumnStates(),
  ])

  return (
    <UxKanbanClient
      initialResult={result}
      members={serializeRscProps(members)}
      initialAssignments={assignments}
      initialTarefasResult={serializeRscProps(tarefasResult)}
      columnStateMap={columnStateMap}
    />
  )
}
