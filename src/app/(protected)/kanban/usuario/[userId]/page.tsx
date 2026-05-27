import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { getUserKanbanData } from "@/features/kanban/actions/ux-kanban"
import { UserKanbanClient } from "./UserKanbanClient"

export const dynamic = "force-dynamic"

export default async function UserKanbanPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "menu.kanban")) redirect("/dashboard")

  const data = await getUserKanbanData(userId)

  return <UserKanbanClient userId={userId} data={data} />
}
