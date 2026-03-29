import { redirect } from "next/navigation"
import { checkIsAdmin } from "@/lib/session"
import NovoSistemaForm from "./NovoSistemaForm"

export default async function NovoSistemaPage() {
  const isAdmin = await checkIsAdmin()
  if (!isAdmin) redirect("/configuracoes/sistemas")
  return <NovoSistemaForm />
}
