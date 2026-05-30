import type { ElementType } from "react"
import { Users, Clock, Clock4, Calendar, Target, Check } from "lucide-react"

export type EquipeTabId =
  | "lancamentos"
  | "clockwork"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "metas"
  | "aniversarios"

export const EQUIPE_TAB_IDS: EquipeTabId[] = [
  "lancamentos",
  "clockwork",
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
  { id: "lancamentos",  label: "Registros",    icon: Check     },
  { id: "clockwork",    label: "Clockwork",    icon: Clock4    },
  { id: "chapters",     label: "Chapters",     icon: Users     },
  { id: "horarios",     label: "Horários",     icon: Clock     },
  { id: "ferias",       label: "Férias",       icon: Calendar  },
  { id: "ausencias",    label: "Ausências",    icon: Calendar  },
  { id: "metas",        label: "OKRs",         icon: Target    },
  { id: "aniversarios", label: "Aniversários", icon: Users     },
]
