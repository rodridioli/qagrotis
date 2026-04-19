import { getSistemasEModulos } from "@/lib/actions/equipe"
import EquipeClient from "./EquipeClient"

export default async function EquipePage() {
  const { sistemas, modulosPorSistema } = await getSistemasEModulos()
  return <EquipeClient sistemas={sistemas} modulosPorSistema={modulosPorSistema} />
}
