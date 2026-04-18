import { unstable_cache } from "next/cache"
import { getSistemas } from "@/lib/actions/sistemas"
import { getIntegracoes } from "@/lib/actions/integracoes"
import { getModulos } from "@/lib/actions/modulos"

// Cache tag used to invalidate menu data when systems/integracoes change
export const LAYOUT_CACHE_TAG = "layout-menu"

export const getLayoutMenuData = unstable_cache(
  async () => {
    const [sistemas, integracoes, modulos] = await Promise.all([
      getSistemas(),
      getIntegracoes(),
      getModulos(),
    ])
    const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
    const activeIntegracoes = integracoes.filter((i) => i.active)
    // Check if at least one active sistema has at least one active modulo
    const activeSistemaNames = new Set(sistemaNames)
    const hasSistemaComModulo = modulos.some(
      (m) => m.active && activeSistemaNames.has(m.sistemaName)
    )
    return { sistemaNames, activeIntegracoes, hasSistemaComModulo }
  },
  ["layout-menu-data"],
  { tags: [LAYOUT_CACHE_TAG], revalidate: 60 }
)
