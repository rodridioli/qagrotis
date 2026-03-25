import { notFound } from "next/navigation"
import { getSistema } from "@/lib/actions/sistemas"
import EditarSistemaClient from "./EditarSistemaClient"

export default async function EditarSistemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sistema = await getSistema(id)
  if (!sistema) notFound()
  return <EditarSistemaClient sistema={sistema} />
}
