export const dynamic = "force-dynamic"
export const metadata = { title: "Equipes" }

import { redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { buildRole, can } from "@/core/rbac/policy"
import { listLideres } from "@/features/equipe/actions/equipes"
import EquipesClient from "./EquipesClient"

export default async function EquipesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "config.equipes")) redirect("/configuracoes")

  const lideres = await listLideres().catch(() => [])

  return <EquipesClient initialLideres={lideres} />
}
