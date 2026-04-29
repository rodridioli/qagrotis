export const metadata = { title: "Editar sistema" }

import { notFound, redirect } from "next/navigation"
import { getSistema } from "@/lib/actions/sistemas"
import { checkIsAdmin } from "@/lib/session"
import EditarSistemaClient from "./EditarSistemaClient"

export default async function EditarSistemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [sistema, isAdmin] = await Promise.all([getSistema(id), checkIsAdmin()])
  if (!sistema) notFound()
  if (!isAdmin) redirect("/configuracoes/sistemas")
  return <EditarSistemaClient sistema={sistema} />
}
