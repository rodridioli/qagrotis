import { unstable_cache } from "next/cache"
import { getSistemas } from "@/lib/actions/sistemas"
import { getIntegracoes } from "@/lib/actions/integracoes"

// Cache tag used to invalidate menu data when systems/integracoes change
export const LAYOUT_CACHE_TAG = "layout-menu"

// Cache only sistemas and integracoes — these change infrequently.
// Module/cenario checks are removed from the menu to avoid stale-data flicker.
export const getLayoutMenuData = unstable_cache(
  async () => {
    const [sistemas, integracoes] = await Promise.all([
      getSistemas(),
      getIntegracoes(),
    ])
    const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
    const activeIntegracoes = integracoes.filter((i) => i.active)
    return { sistemaNames, activeIntegracoes }
  },
  ["layout-menu-data"],
  { tags: [LAYOUT_CACHE_TAG], revalidate: 60 }
)
