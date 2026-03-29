import { redirect } from "next/navigation"
import { getSistemas } from "@/lib/actions/sistemas"
import { checkIsAdmin } from "@/lib/session"
import NovoModuloClient from "./NovoModuloClient"

export default async function NovoModuloPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/configuracoes/modulos")
  const sistemas = await getSistemas()
  const sistemasAtivos = sistemas.filter((s) => s.active)
  return <NovoModuloClient sistemas={sistemasAtivos} />
}
