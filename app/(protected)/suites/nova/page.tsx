import { getActiveSistemaNames } from "@/lib/actions/sistemas"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"
import { SuiteForm } from "@/components/qagrotis/SuiteForm"

export default async function NovaSuitePage() {
  const [systemList, allModulos, allCenarios] = await Promise.all([
    getActiveSistemaNames(),
    getModulos(),
    getCenarios()
  ])
  
  const activeModulos = allModulos.filter(m => m.active)
  const activeCenarios = allCenarios.filter(c => c.active)

  return (
    <SuiteForm 
      mode="create" 
      systemList={systemList} 
      allModulos={activeModulos} 
      allCenarios={activeCenarios}
    />
  )
}
