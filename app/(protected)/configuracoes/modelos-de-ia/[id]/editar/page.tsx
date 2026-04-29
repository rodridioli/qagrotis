export const metadata = { title: "Editar modelo de IA" }

import { notFound, redirect } from "next/navigation"
import { getIntegracao } from "@/lib/actions/integracoes"
import { checkIsAdmin } from "@/lib/session"
import EditarIntegracaoClient from "./EditarIntegracaoClient"

export default async function EditarIntegracaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [integracao, isAdmin] = await Promise.all([getIntegracao(id), checkIsAdmin()])
  if (!integracao) notFound()
  if (!isAdmin) redirect("/configuracoes/modelos-de-ia")
  return <EditarIntegracaoClient integracao={integracao} />
}
