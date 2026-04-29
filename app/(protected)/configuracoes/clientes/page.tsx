export const dynamic = "force-dynamic"
export const metadata = { title: "Clientes" }

import { getClientes } from "@/lib/actions/clientes"
import { getCenarios } from "@/lib/actions/cenarios"
import { checkIsAdmin } from "@/lib/session"
import ClientesClient from "./ClientesClient"

export default async function ClientesPage() {
  const [clientes, cenarios, isAdmin] = await Promise.all([getClientes(), getCenarios(), checkIsAdmin()])
  return <ClientesClient initialClientes={clientes} initialCenarios={cenarios} isAdmin={isAdmin} />
}
