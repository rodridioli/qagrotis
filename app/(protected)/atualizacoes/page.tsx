import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import { getChangelog } from "@/lib/actions/changelog"
import { AtualizacoesClient } from "./AtualizacoesClient"

export default async function AtualizacoesPage() {
  const [session, users, entries] = await Promise.all([
    auth(),
    getQaUsers(),
    getChangelog(),
  ])

  // Only admins can access this page
  const sessionEmail = session?.user?.email?.toLowerCase() ?? ""
  const currentUser = users.find((u) => u.email.toLowerCase() === sessionEmail)
  if (!currentUser || currentUser.type !== "Administrador") {
    redirect("/dashboard")
  }

  return <AtualizacoesClient entries={entries} />
}
