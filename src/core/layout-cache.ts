import { unstable_cache } from "next/cache"
import { prisma } from "@/core/prisma"
import type { IntegracaoSafeRecord } from "@/features/integracoes/actions/integracoes"

// Cache tag used to invalidate menu data when systems/integracoes change
export const LAYOUT_CACHE_TAG = "layout-menu"

// Queries diretas ao banco — sem requireSession() — para evitar race condition
// com o login por credentials (signIn redirect:false + router.push).
// A proteção de rota já é garantida pelo authConfig.authorized no middleware.
export const getLayoutMenuData = unstable_cache(
  async () => {
    const [sistemas, modulos, integracoes, cenariosCount] = await Promise.all([
      prisma.sistema.findMany({ select: { name: true, active: true }, take: 200 }),
      prisma.modulo.findMany({ select: { active: true, sistemaName: true }, take: 500 }),
      prisma.integracao.findMany({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, descricao: true, provider: true, model: true, active: true, createdAt: true },
      }),
      prisma.cenario.count({ where: { active: true } }),
    ])

    const sistemaNames = sistemas.filter((s) => s.active).map((s) => s.name)
    const activeSistemaNames = new Set(sistemaNames)
    const hasSistemaComModulo = modulos.some(
      (m) => m.active && activeSistemaNames.has(m.sistemaName)
    )
    const activeIntegracoes: IntegracaoSafeRecord[] = integracoes.map((i) => ({
      ...i,
      createdAt: i.createdAt != null ? i.createdAt.getTime() : Date.now(),
    }))
    const hasCenario = cenariosCount > 0

    return { sistemaNames, activeIntegracoes, hasSistemaComModulo, hasCenario }
  },
  ["layout-menu-data"],
  { tags: [LAYOUT_CACHE_TAG], revalidate: 60 }
)
