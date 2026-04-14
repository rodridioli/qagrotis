import { unstable_cache } from "next/cache"
import { getSistemas } from "@/lib/actions/sistemas"
import { getIntegracoes } from "@/lib/actions/integracoes"
import { getModulos } from "@/lib/actions/modulos"
import { getCenarios } from "@/lib/actions/cenarios"

// Cache tag used to invalidate menu data when systems/modules/cenarios change
export const LAYOUT_CACHE_TAG = "layout-menu"

// Cache the layout menu data with a 30s revalidation.
// This avoids running 4 DB queries on every navigation while keeping data fresh.
export const getLayoutMenuData = unstable_cache(
  async () => {
    const [sistemas, integracoes, modulos, cenarios] = await Promise.all([
      getSistemas(),
      getIntegracoes(),
      getModulos(),
      getCenarios(),
    ])

    const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
    const activeIntegracoes = integracoes.filter((i) => i.active)
    const sistemaComModulo = [
      ...new Set(modulos.filter((m) => m.active).map((m) => m.sistemaName)),
    ]
    const sistemaComCenario = [
      ...new Set(cenarios.filter((c) => c.active).map((c) => c.system)),
    ]

    return { sistemaNames, activeIntegracoes, sistemaComModulo, sistemaComCenario }
  },
  ["layout-menu-data"],
  { tags: [LAYOUT_CACHE_TAG], revalidate: 30 }
)
