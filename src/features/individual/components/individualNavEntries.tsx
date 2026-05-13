"use client"

import type { ElementType } from "react"
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
  Clock,
} from "lucide-react"
import {
  INDIVIDUAL_SECTION_ORDER,
  INDIVIDUAL_SECTION_LABELS,
  type IndividualSectionSlug,
} from "@/features/individual/lib/individual-sections"

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
  lancamentos: Clock,
}

export interface IndividualNavEntry {
  slug: IndividualSectionSlug
  label: string
  icon: ElementType
}

export const INDIVIDUAL_NAV_ENTRIES: IndividualNavEntry[] = INDIVIDUAL_SECTION_ORDER.map((slug) => ({
  slug,
  label: INDIVIDUAL_SECTION_LABELS[slug],
  icon: ICONS[slug],
}))
