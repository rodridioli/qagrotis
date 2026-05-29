"use client"

import React, { useState, useMemo, useEffect, Suspense } from "react"
import {
  getEquipeListagemCadastro,
  type EquipeUsuarioCadastro,
} from "@/features/equipe/actions/equipe"
import { EquipeAniversarioCard } from "@/features/equipe/components/EquipeAniversarioCard"
import { EquipeHorariosTable } from "@/features/equipe/components/EquipeHorariosTable"
import { EquipeChaptersSection } from "@/features/equipe/components/EquipeChaptersSection"
import { EquipeFeriasSection } from "@/features/equipe/components/EquipeFeriasSection"
import { EquipeAusenciasSection } from "@/features/equipe/components/EquipeAusenciasSection"
import { EquipeLancamentosSection } from "@/features/equipe/components/EquipeLancamentosSection"
import { EquipeClockworkSection } from "@/features/equipe/components/EquipeClockworkSection"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionSpinner } from "@/components/shared/SectionSpinner"

// ── Types ────────────────────────────────────────────────────────────────────

type AccessProfileId = "QA" | "UX" | "TW" | "MGR"

interface Props {
  isAdmin: boolean
  userAccessProfile: AccessProfileId
  canFilterByProfile: boolean
  canAccessEquipeLancamentos: boolean
  canAccessEquipeClockwork: boolean
  canViewOthersClockwork: boolean
  currentUserId: string
  isMgr: boolean
  initialTab?: TabId
}

type TabId =
  | "lancamentos"
  | "clockwork"
  | "chapters"
  | "horarios"
  | "ferias"
  | "ausencias"
  | "metas"
  | "aniversarios"

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDataNascimentoBr(iso: string): string {
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`
}

/** Mês do aniversário (1–12) a partir de `yyyy-mm-dd`. */
function parseMesNascimento(iso: string): number | null {
  const m = parseInt(iso.split("-")[1] ?? "", 10)
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return m
}

function parseDiaNascimento(iso: string): number {
  const d = parseInt(iso.split("-")[2] ?? "", 10)
  return Number.isFinite(d) ? d : 0
}

/** Cabeçalho do grupo (ex.: Janeiro). */
function tituloMesNascimentoPt(month1to12: number): string {
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month1to12 - 1, 1)),
  )
  return label.length ? label.charAt(0).toUpperCase() + label.slice(1) : String(month1to12)
}

// ── Main component ───────────────────────────────────────────────────────────

export default function EquipeClient({
  isAdmin,
  userAccessProfile,
  canFilterByProfile,
  canAccessEquipeLancamentos,
  canAccessEquipeClockwork,
  canViewOthersClockwork,
  currentUserId,
  isMgr,
  initialTab = "chapters",
}: Props) {
  function safeTab(tab: TabId): TabId {
    if (tab === "lancamentos" && !canAccessEquipeLancamentos) return "chapters"
    if (tab === "clockwork" && !canAccessEquipeClockwork) return "chapters"
    return tab
  }

  const [activeTab, setActiveTab] = useState<TabId>(safeTab(initialTab))

  useEffect(() => {
    setActiveTab(safeTab(initialTab))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, canAccessEquipeLancamentos, canAccessEquipeClockwork])

  const [aniversariantes, setAniversariantes] = useState<EquipeUsuarioCadastro[]>([])
  const [comHorario, setComHorario] = useState<EquipeUsuarioCadastro[]>([])
  const [cadastroLoading, setCadastroLoading] = useState(false)
  const [cadastroError, setCadastroError] = useState<string | null>(null)

const aniversariantesPorMes = useMemo(() => {
    const byMonth = new Map<number, EquipeUsuarioCadastro[]>()
    for (const u of aniversariantes) {
      const iso = u.dataNascimentoIso
      if (!iso) continue
      const month = parseMesNascimento(iso)
      if (month == null) continue
      if (!byMonth.has(month)) byMonth.set(month, [])
      byMonth.get(month)!.push(u)
    }
    const months = [...byMonth.keys()].sort((a, b) => a - b)
    return months.map((month) => ({
      month,
      titulo: tituloMesNascimentoPt(month),
      users: (byMonth.get(month) ?? []).sort((a, b) => {
        const da = parseDiaNascimento(a.dataNascimentoIso ?? "")
        const db = parseDiaNascimento(b.dataNascimentoIso ?? "")
        if (da !== db) return da - db
        return a.name.localeCompare(b.name, "pt-BR")
      }),
    }))
  }, [aniversariantes])

  useEffect(() => {
    if (activeTab !== "aniversarios" && activeTab !== "horarios") return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setCadastroLoading(true)
      setCadastroError(null)
    })
    getEquipeListagemCadastro()
      .then((data) => {
        if (!cancelled) {
          setAniversariantes(data.aniversariantes)
          setComHorario(data.comHorario)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAniversariantes([])
          setComHorario([])
          setCadastroError("Não foi possível carregar os dados. Tente novamente em instantes.")
        }
      })
      .finally(() => {
        if (!cancelled) setCadastroLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  return (
    <div className="space-y-5">
      {activeTab === "aniversarios" && (
        <div className="space-y-4">
          {cadastroLoading ? (
            <SectionSpinner minHeight="min-h-[60vh]" />
          ) : cadastroError ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
              <p className="text-center text-sm text-destructive">{cadastroError}</p>
            </div>
          ) : aniversariantes.length === 0 ? (
            <EmptyState message="Nenhum registro encontrado." />
          ) : (
            <div className="space-y-8">
              {aniversariantesPorMes.map(({ month, titulo, users }) => (
                <section key={month} aria-labelledby={`mes-aniversario-${month}`} className="space-y-4">
                  <div className="border-b border-border-default pb-2">
                    <h2
                      id={`mes-aniversario-${month}`}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-semibold text-text-primary"
                    >
                      <span className="uppercase tracking-wide text-text-secondary">{titulo}</span>
                      <span className="text-sm font-normal normal-case text-text-secondary">
                        {users.length} {users.length === 1 ? "aniversariante" : "aniversariantes"}
                      </span>
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {users.map((u) => (
                      <EquipeAniversarioCard
                        key={u.userId}
                        name={u.name}
                        classificacao={u.classificacao}
                        photoPath={u.photoPath}
                        dataNascimentoLabel={
                          u.dataNascimentoIso ? formatDataNascimentoBr(u.dataNascimentoIso) : "—"
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "horarios" && (
        <div className="space-y-4">
          {cadastroLoading ? (
            <SectionSpinner minHeight="min-h-[60vh]" />
          ) : cadastroError ? (
            <div className="flex items-center justify-center rounded-custom border border-border-default bg-surface-card py-16 shadow-card px-4">
              <p className="text-center text-sm text-destructive">{cadastroError}</p>
            </div>
          ) : (
            <EquipeHorariosTable rows={comHorario} />
          )}
        </div>
      )}

      {activeTab === "lancamentos" && canAccessEquipeLancamentos && (
        <Suspense fallback={<SectionSpinner minHeight="min-h-[60vh]" />}>
          <EquipeLancamentosSection
            userAccessProfile={userAccessProfile}
            canFilterByProfile={canFilterByProfile}
          />
        </Suspense>
      )}

      {activeTab === "clockwork" && canAccessEquipeClockwork && (
        <Suspense fallback={<SectionSpinner minHeight="min-h-[60vh]" />}>
          <EquipeClockworkSection
            userAccessProfile={userAccessProfile}
            canFilterByProfile={canFilterByProfile}
            canViewOthersClockwork={canViewOthersClockwork}
            currentUserId={currentUserId}
          />
        </Suspense>
      )}

      {activeTab === "chapters" && <EquipeChaptersSection isAdmin={isAdmin} currentUserId={currentUserId} />}

      {activeTab === "ferias" && <EquipeFeriasSection />}

      {activeTab === "ausencias" && <EquipeAusenciasSection isMgr={isMgr} currentUserId={currentUserId} />}

      {activeTab === "metas" && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Em desenvolvimento.</p>
        </div>
      )}
    </div>
  )
}
