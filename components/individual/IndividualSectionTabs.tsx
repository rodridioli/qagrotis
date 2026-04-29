"use client"

import type { ElementType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IdCard,
  Target,
  Calendar,
  CalendarX,
  ClipboardCheck,
  MessageSquare,
  Award,
  TrendingUp,
  LineChart,
} from "lucide-react"
import {
  INDIVIDUAL_SECTION_LABELS,
  INDIVIDUAL_SECTION_ORDER,
  type IndividualSectionSlug,
} from "@/lib/individual-sections"
import { cn } from "@/lib/utils"

const ICONS: Record<IndividualSectionSlug, ElementType> = {
  ficha: IdCard,
  dominio: Target,
  ferias: Calendar,
  ausencias: CalendarX,
  avaliacoes: ClipboardCheck,
  feedbacks: MessageSquare,
  conquistas: Award,
  pdi: TrendingUp,
  progressao: LineChart,
}

const SECTIONS: { href: IndividualSectionSlug; label: string; icon: ElementType }[] =
  INDIVIDUAL_SECTION_ORDER.map((href) => ({
    href,
    label: INDIVIDUAL_SECTION_LABELS[href],
    icon: ICONS[href],
  }))

export interface IndividualSectionTabsPresentationProps {
  pathname: string
  /** Ex.: `?userId=U-23` ou string vazia */
  querySuffix: string
}

/** Útil em Storybook e testes (sem `usePathname`). */
export function IndividualSectionTabsPresentation({
  pathname,
  querySuffix,
}: IndividualSectionTabsPresentationProps) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-custom border border-border-default bg-surface-card p-1 shadow-card">
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = pathname === `/individual/${href}`
        return (
          <Link
            key={href}
            href={`/individual/${href}${querySuffix}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              active
                ? "bg-brand-primary text-white shadow-sm"
                : "text-text-secondary hover:bg-neutral-grey-100 hover:text-text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        )
      })}
    </div>
  )
}

interface IndividualSectionTabsProps {
  querySuffix: string
}

export function IndividualSectionTabs({ querySuffix }: IndividualSectionTabsProps) {
  const pathname = usePathname()
  return <IndividualSectionTabsPresentation pathname={pathname} querySuffix={querySuffix} />
}
