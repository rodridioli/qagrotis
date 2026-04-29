export const metadata = { title: "Novo cliente" }

import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/session"
import NovoClienteForm from "./NovoClienteForm"

export default async function NovoClientePage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/configuracoes/clientes")
  return <NovoClienteForm />
}
