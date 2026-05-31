import type { ElementType } from "react"
import { Users, Clock, Clock4, Calendar, Check } from "lucide-react"

export type EquipeTabId =
  | "lancamentos"
  | "clockwork"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "aniversarios"

export const EQUIPE_TAB_IDS: EquipeTabId[] = [
  "lancamentos",
  "clockwork",
  "chapters",
  "horarios",
  "ferias",
  "ausencias",
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
  { id: "aniversarios", label: "Aniversários", icon: Users     },
]
