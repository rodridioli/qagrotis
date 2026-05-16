"use client"

import * as React from "react"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"
import { IndividualLancamentosSection } from "@/features/individual/components/IndividualLancamentosSection"
import {
  getEquipeMembrosParaLancamentos,
  type EquipeMembroLancamentos,
} from "@/features/equipe/actions/equipe"

type AccessProfileId = "QA" | "UX" | "TW" | "MGR"

const PROFILE_OPTIONS: { value: AccessProfileId; label: string }[] = [
  { value: "QA",  label: "QA"      },
  { value: "UX",  label: "UX"      },
  { value: "TW",  label: "TW"      },
  { value: "MGR", label: "Manager" },
]

interface Props {
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
}

export function EquipeLancamentosSection({ userAccessProfile, canFilterByProfile }: Props) {
  const [profileFilter, setProfileFilter] = React.useState<AccessProfileId>(userAccessProfile)
  const [membros, setMembros] = React.useState<EquipeMembroLancamentos[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedUserId(null)
    const profile = canFilterByProfile ? profileFilter : userAccessProfile
    getEquipeMembrosParaLancamentos(profile).then((data) => {
      if (!cancelled) {
        setMembros(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [profileFilter, canFilterByProfile, userAccessProfile])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canFilterByProfile && (
          <Select
            value={profileFilter}
            onValueChange={(v) => v && setProfileFilter(v as AccessProfileId)}
          >
            <SelectTrigger className="w-40" aria-label="Filtrar por perfil">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {PROFILE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}

        <Select
          value={selectedUserId ?? ""}
          onValueChange={(v) => setSelectedUserId(v || null)}
          disabled={loading || membros.length === 0}
        >
          <SelectTrigger className="w-56" aria-label="Selecionar membro">
            <SelectValue placeholder="Selecionar membro…" />
          </SelectTrigger>
          <SelectPopup>
            {membros.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {loading && <SectionSpinner />}
      </div>

      {!loading && membros.length === 0 && (
        <EmptyState message="Nenhum membro encontrado neste perfil." />
      )}

      {!loading && membros.length > 0 && !selectedUserId && (
        <EmptyState
          message="Selecione um membro acima para visualizar os lançamentos."
        />
      )}

      {selectedUserId && (
        <IndividualLancamentosSection evaluatedUserId={selectedUserId} />
      )}
    </div>
  )
}
