export const metadata = { title: "Editar cliente" }

import { notFound } from "next/navigation"
import { getCliente } from "@/lib/actions/clientes"
import EditarClienteClient from "./EditarClienteClient"

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await getCliente(id)
  if (!cliente) notFound()
  return <EditarClienteClient cliente={cliente} />
}
