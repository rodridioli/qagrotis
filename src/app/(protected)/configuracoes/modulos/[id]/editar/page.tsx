export const metadata = { title: "Editar módulo" }

import { notFound, redirect } from "next/navigation"
import { getModulo } from "@/features/qa/actions/modulos"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { checkIsAdmin } from "@/core/session"
import EditarModuloClient from "./EditarModuloClient"

export default async function EditarModuloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [modulo, sistemas, isAdmin] = await Promise.all([getModulo(id), getSistemas(), checkIsAdmin()])
  if (!modulo) notFound()
  if (!isAdmin) redirect("/configuracoes/modulos")
  const sistemasAtivos = sistemas.filter((s) => s.active)
  return <EditarModuloClient modulo={modulo} sistemas={sistemasAtivos} />
}
