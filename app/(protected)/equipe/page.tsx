export const dynamic = "force-dynamic"

import { getSistemasEModulos } from "@/lib/actions/equipe"
import { serializeRscProps } from "@/lib/rsc-serialize"
import EquipeClient from "./EquipeClient"

export default async function EquipePage() {
  let sistemas: string[] = []
  let modulosPorSistema: Record<string, string[]> = {}
  try {
    const data = await getSistemasEModulos()
    sistemas = data.sistemas
    modulosPorSistema = data.modulosPorSistema
  } catch {
    // DB indisponível ou erro Prisma — a página continua renderizando; filtros ficam vazios
  }
  return (
    <EquipeClient
      sistemas={serializeRscProps(sistemas)}
      modulosPorSistema={serializeRscProps(modulosPorSistema)}
    />
  )
}
