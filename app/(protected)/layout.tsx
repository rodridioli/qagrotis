import { getSistemas } from "@/lib/actions/sistemas"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const sistemas = await getSistemas()
  const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
  return <LayoutClient sistemaNames={sistemaNames}>{children}</LayoutClient>
}
