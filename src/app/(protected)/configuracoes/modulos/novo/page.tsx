export const metadata = { title: "Novo módulo" }

import { redirect } from "next/navigation"
import { getSistemas } from "@/features/qa/actions/sistemas"
import { checkIsAdmin } from "@/core/session"
import NovoModuloClient from "./NovoModuloClient"

export default async function NovoModuloPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/configuracoes/modulos")
  const sistemas = await getSistemas()
  const sistemasAtivos = sistemas.filter((s) => s.active)
  return <NovoModuloClient sistemas={sistemasAtivos} />
}
