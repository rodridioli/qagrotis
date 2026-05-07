export const metadata = { title: "Novo modelo de IA" }

import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/session"
import NovaIntegracaoForm from "./NovaIntegracaoForm"

export default async function NovaIntegracaoPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/configuracoes/modelos-de-ia")
  return <NovaIntegracaoForm />
}
