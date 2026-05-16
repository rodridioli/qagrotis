import type { ElementType } from "react"
import { BarChart3, Users, Clock, Calendar, Target, Timer } from "lucide-react"

export type EquipeTabId =
  | "lancamentos"
  | "performance"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "metas"
  | "aniversarios"

export const EQUIPE_TAB_IDS: EquipeTabId[] = [
  "lancamentos",
  "performance",
  "chapters",
  "horarios",
  "ferias",
  "ausencias",
  "metas",
  "aniversarios",
]

export interface EquipeNavEntry {
  id: EquipeTabId
  label: string
  icon: ElementType
}

export const EQUIPE_NAV_ENTRIES: EquipeNavEntry[] = [
  { id: "lancamentos",  label: "Lançamentos",        icon: Timer     },
  { id: "performance",  label: "Visão geral",        icon: BarChart3 },
  { id: "chapters",     label: "Chapters",           icon: Users     },
  { id: "horarios",     label: "Horários",           icon: Clock     },
  { id: "ferias",       label: "Férias",             icon: Calendar  },
  { id: "ausencias",    label: "Ausências",          icon: Calendar  },
  { id: "metas",        label: "OKRs",               icon: Target    },
  { id: "aniversarios", label: "Aniversários",       icon: Users     },
]
