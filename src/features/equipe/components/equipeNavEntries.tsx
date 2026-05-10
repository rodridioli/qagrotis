"use client"

import type { ElementType } from "react"
import { BarChart3, Users, Clock, Calendar, CalendarX, Target } from "lucide-react"

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
  { id: "performance",  label: "Performance",   icon: BarChart3  },
  { id: "chapters",     label: "Chapters",       icon: Users      },
  { id: "horarios",     label: "Horários",       icon: Clock      },
  { id: "ferias",       label: "Férias",         icon: Calendar   },
  { id: "ausencias",    label: "Ausências",      icon: CalendarX  },
  { id: "metas",        label: "Metas",          icon: Target     },
  { id: "aniversarios", label: "Aniversários",   icon: Users      },
]

export function isEquipeTabId(v: string): v is EquipeTabId {
  return (EQUIPE_TAB_IDS as string[]).includes(v)
}
