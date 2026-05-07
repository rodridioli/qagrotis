"use client"

import * as React from "react"
import {
  Trophy,
  MonitorPlay,
  ThumbsUp,
  GraduationCap,
  Languages,
  type LucideIcon,
} from "lucide-react"
import { BadgeAchievement } from "@/components/individual/BadgeAchievement"
import { listUserBadges } from "@/actions/conquistas"
import {
  BADGE_DEFINITIONS,
  BADGE_CATEGORIES,
  type BadgeCategoryId,
  type BadgeResult,
} from "@/lib/conquistas"

// ── Display config (icon + color per category) ────────────────────────────────

const CATEGORY_ICON: Record<BadgeCategoryId, LucideIcon> = {
  tempo:     Trophy,
  chapters:  MonitorPlay,
  feedbacks: ThumbsUp,
  formacao:  GraduationCap,
  idioma:    Languages,
}

const CATEGORY_COLOR: Record<BadgeCategoryId, string> = {
  tempo:     "var(--qagrotis-primary-500)",
  chapters:  "var(--badge-info)",
  feedbacks: "var(--badge-orange)",
  formacao:  "var(--badge-warning)",
  idioma:    "var(--badge-purple)",
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BadgeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="size-[5.5rem] animate-pulse rounded-full bg-neutral-grey-200" />
      <div className="h-3 w-12 animate-pulse rounded bg-neutral-grey-100" />
    </div>
  )
}

// ── Main section ──────────────────────────────────────────────────────────────

export interface ConquistasSectionProps {
  evaluatedUserId?: string
}

export function ConquistasSection({ evaluatedUserId }: ConquistasSectionProps) {
  const [results, setResults] = React.useState<BadgeResult[]>([])
  const [tenureMonths, setTenureMonths] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadBadges = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listUserBadges(evaluatedUserId)
      setResults(data.badges)
      setTenureMonths(data.tenureMonths)
    } catch (e) {
      console.error("[ConquistasSection]", e)
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar as conquistas.",
      )
    } finally {
      setLoading(false)
    }
  }, [evaluatedUserId])

  React.useEffect(() => {
    void loadBadges()
  }, [loadBadges])

  const resultMap = React.useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const r of results) m[r.id] = r.unlocked
    return m
  }, [results])

  function formatTenure(months: number) {
    const years = Math.floor(months / 12)
    const m = months % 12
    if (years === 0) return `${m} ${m === 1 ? "mês" : "meses"}`
    if (m === 0) return `${years} ${years === 1 ? "ano" : "anos"}`
    return `${years} ${years === 1 ? "ano" : "anos"} e ${m} ${m === 1 ? "mês" : "meses"}`
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadBadges()}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {BADGE_CATEGORIES.map((category) => {
        const defs = BADGE_DEFINITIONS.filter(
          (d) => d.categoryId === category.id,
        )
        const Icon = CATEGORY_ICON[category.id]
        const color = CATEGORY_COLOR[category.id]
        const groupBadges = defs.map((def) => ({
          ...def,
          unlocked: resultMap[def.id] ?? false,
        }))
        const unlockedCount = groupBadges.filter(b => b.unlocked).length

        return (
          <section key={category.id} className="overflow-hidden rounded-xl border border-border-default bg-surface-card shadow-card">
            <div className="flex items-center justify-between border-b border-border-default bg-neutral-grey-50/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <Icon
                  className="size-4 text-text-secondary"
                  aria-hidden
                />
                <h3 className="text-sm font-semibold text-text-primary">
                  {category.label}
                </h3>
              </div>
              <span className="text-xs font-medium text-text-secondary">
                {category.id === "tempo" 
                  ? `Tempo de empresa: ${formatTenure(tenureMonths)}`
                  : `${unlockedCount} de ${defs.length} conquistados`
                }
              </span>
            </div>

            <div className="flex flex-wrap gap-6 p-6 sm:gap-10">
              {loading ? (
                defs.map((_, i) => <BadgeSkeleton key={i} />)
              ) : groupBadges.length === 0 ? (
                <p className="text-sm italic text-text-secondary">Nenhum registro encontrado.</p>
              ) : (
                groupBadges.map((def) => (
                  <BadgeAchievement
                    key={def.id}
                    label={def.label}
                    icon={Icon}
                    color={color}
                    unlocked={def.unlocked}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
