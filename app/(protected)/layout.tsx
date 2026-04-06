import { getSistemas } from "@/lib/actions/sistemas"
import { getIntegracoes } from "@/lib/actions/integracoes"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemas: Awaited<ReturnType<typeof getSistemas>> = []
  let integracoes: Awaited<ReturnType<typeof getIntegracoes>> = []
  try {
    ;[sistemas, integracoes] = await Promise.all([getSistemas(), getIntegracoes()])
  } catch {
    // If DB is temporarily unavailable, render layout without lista
  }
  const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
  const activeIntegracoes = integracoes.filter((i) => i.active)
  return (
    <LayoutClient sistemaNames={sistemaNames} integracoes={activeIntegracoes}>
      {children}
    </LayoutClient>
  )
}
