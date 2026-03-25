import { notFound } from "next/navigation"
import { getModulo } from "@/lib/actions/modulos"
import { getSistemas } from "@/lib/actions/sistemas"
import EditarModuloClient from "./EditarModuloClient"

export default async function EditarModuloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [modulo, sistemas] = await Promise.all([getModulo(id), getSistemas()])
  if (!modulo) notFound()
  const sistemasAtivos = sistemas.filter((s) => s.active)
  return <EditarModuloClient modulo={modulo} sistemas={sistemasAtivos} />
}
