import type { ElementType } from "react"
import { BarChart3, Users, Clock, Calendar, Target } from "lucide-react"

export type EquipeTabId =
  | "performance"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "metas"
  | "aniversarios"

export const EQUIPE_TAB_IDS: EquipeTabId[] = [
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
  { id: "performance",  label: "Visão geral",        icon: BarChart3 },
  { id: "chapters",     label: "Chapters",           icon: Users     },
  { id: "horarios",     label: "Disponibilidade",    icon: Clock     },
  { id: "ferias",       label: "Aviso de Férias",    icon: Calendar  },
  { id: "ausencias",    label: "Aviso de Ausências", icon: Calendar  },
  { id: "metas",        label: "OKRs",               icon: Target    },
  { id: "aniversarios", label: "Aniversários",       icon: Users     },
]
