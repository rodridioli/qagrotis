export const metadata = { title: "Novo usuário" }

import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/session"
import { auth } from "@/lib/auth"
import { buildRole, manageableProfiles } from "@/lib/rbac/policy"
import UsuarioFormTabs from "../UsuarioFormTabs"

export default async function NovoUsuarioPage() {
  const [isAdmin, session] = await Promise.all([checkIsAdmin(), auth()])
  if (!isAdmin) redirect("/configuracoes/usuarios")

  const role = buildRole(session?.user?.type, session?.user?.accessProfile)
  const allowed = manageableProfiles(role)

  return (
    <UsuarioFormTabs
      mode="create"
      manageableProfiles={allowed}
      sessionUser={session?.user as any}
    />
  )
}
