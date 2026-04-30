export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildRole, can } from "@/lib/rbac/policy"
import { getActiveQaUsers } from "@/lib/actions/usuarios"
import { NovaIndividualAvaliacaoCadastroClient } from "@/components/individual/NovaIndividualAvaliacaoCadastroClient"

export const metadata = { title: "Nova avaliação" }

export default async function NovaIndividualAvaliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const role = buildRole(session.user.type, session.user.accessProfile)
  if (!can(role, "individual.viewOthers")) redirect("/dashboard")

  const { userId } = await searchParams
  if (!userId?.trim()) redirect("/individual/ficha")

  const activeUsers = await getActiveQaUsers()
  const u = activeUsers.find((x) => x.id === userId)
  if (!u) {
    redirect("/individual/avaliacoes")
  }

  return (
    <NovaIndividualAvaliacaoCadastroClient
      evaluatedUserId={userId}
      evaluatedUser={{ name: u.name, email: u.email ?? null, photoPath: u.photoPath }}
    />
  )
}
