import { getSistemas } from "@/lib/actions/sistemas"
import LayoutClient from "./LayoutClient"

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let sistemas: Awaited<ReturnType<typeof getSistemas>> = []
  try {
    sistemas = await getSistemas()
  } catch {
    // If DB is temporarily unavailable, render layout without sistema list
  }
  const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
  return <LayoutClient sistemaNames={sistemaNames}>{children}</LayoutClient>
}
