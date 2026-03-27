import { getClientes } from "@/lib/actions/clientes"
import { getCenarios } from "@/lib/actions/cenarios"
import { auth } from "@/lib/auth"
import { getQaUsers } from "@/lib/actions/usuarios"
import ClientesClient from "./ClientesClient"

export default async function ClientesPage() {
  const [session, clientes, cenarios, users] = await Promise.all([auth(), getClientes(), getCenarios(), getQaUsers()])
  const currentUser = users.find((u) => u.id === session?.user?.id)
  const isAdmin = !currentUser || currentUser.type === "Administrador"
  return <ClientesClient initialClientes={clientes} initialCenarios={cenarios} isAdmin={isAdmin} />
}
