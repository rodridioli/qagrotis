export const metadata = { title: "Editar cliente" }

import { notFound, redirect } from "next/navigation"
import { auth } from "@/core/auth"
import { getCliente } from "@/features/qa/actions/clientes"
import EditarClienteClient from "./EditarClienteClient"

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (session?.user?.type !== "Administrador") redirect("/forbidden")
  const cliente = await getCliente(id)
  if (!cliente) notFound()
  return <EditarClienteClient cliente={cliente} />
}
