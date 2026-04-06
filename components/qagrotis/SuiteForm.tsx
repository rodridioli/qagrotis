"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Plus, MoreVertical, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { SYSTEM_LIST } from "@/lib/qagrotis-constants"
import { CenarioTipoBadge, ResultadoBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"
import { ConfirmDialog } from "@/components/qagrotis/ConfirmDialog"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import { criarSuite, atualizarSuite, removerHistoricoSuite, type SuiteRecord } from "@/lib/actions/suites"
import { toast } from "sonner"

export interface SuiteFormProps {
  mode: "create" | "edit"
  suite?: SuiteRecord
  systemList?: string[]
  allModulos?: ModuloRecord[]
  allCenarios?: CenarioRecord[]
}

interface SuiteCenario {
  id: string
  name: string
  module: string
  execucoes: number
  erros: number
  deps: number
  tipo: string
}

interface HistoricoItem {
  id: string
  cenario: string
  module: string
  tipo: string
  deps: number
  data: string
  hora?: string
  timestamp?: number
  resultado: "Sucesso" | "Erro" | "Pendente"
}

type SortedHistoricoItem = HistoricoItem & { _originalIdx: number }

export function SuiteForm({
  mode,
  suite,
  systemList = SYSTEM_LIST,
  allModulos = [],
  allCenarios = []
}: SuiteFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sistemaSelecionado } = useSistemaSelecionado()
  const initialTab = searchParams.get("tab") === "historico" ? "historico" : "cadastro"
  const [activeTab, setActiveTab] = useState<"cadastro" | "cenarios" | "historico">(initialTab)
  const [cenarios, setCenarios] = useState<SuiteCenario[]>(suite?.cenarios ?? [])
  const [historico, setHistorico] = useState<HistoricoItem[]>((suite?.historico ?? []) as HistoricoItem[])

  useEffect(() => {
    if (systemList.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de criar suítes.")
  }, [])

  const [addCenarioOpen, setAddCenarioOpen] = useState(false)
  const [suiteName, setSuiteName] = useState(suite?.suiteName || "")
  const [versao, setVersao] = useState(suite?.versao || "")
  const [selectedModule, setSelectedModule] = useState(suite?.modulo || "")

  const [tipo, setTipo] = useState(suite?.tipo || "")
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedHistorico, setSelectedHistorico] = useState<Set<number>>(new Set())

  function handleExportarJira() {
    const selected = sortedHistorico.filter((h) => selectedHistorico.has(h._originalIdx))
    if (selected.length === 0) return

    const resultIcon = (r: string) => r === "Sucesso" ? "✅" : r === "Erro" ? "❌" : "⏳"

    // ── Detailed blocks ───────────────────────────────────────────────────────
    const details = selected.map((h) => {
      const icon = resultIcon(h.resultado)
      return [
        `### ${h.id} — ${h.cenario} ${icon} ${h.resultado}`,
        `- **Módulo:** ${h.module || "—"}`,
        `- **Tipo:** ${h.tipo || "—"}`,
        `- **Execução:** ${h.data}${h.hora ? ` às ${h.hora}` : ""}`,
        `- **Resultado:** ${icon} ${h.resultado}`,
      ].join("\n")
    }).join("\n\n---\n\n")

    // ── Summary table ─────────────────────────────────────────────────────────
    const tableRows = selected.map((h) =>
      `| ${h.id} | ${h.cenario} | ${h.module || "—"} | ${resultIcon(h.resultado)} ${h.resultado} | ${h.data}${h.hora ? ` ${h.hora}` : ""} |`
    ).join("\n")

    const sucessos = selected.filter((h) => h.resultado === "Sucesso").length
    const erros    = selected.filter((h) => h.resultado === "Erro").length

    const summary = [
      `## Resumo da Execução`,
      ``,
      `| Código | Cenário | Módulo | Resultado | Data/Hora |`,
      `|--------|---------|--------|-----------|-----------|`,
      tableRows,
      ``,
      `**Total:** ${selected.length} | ✅ Sucesso: ${sucessos} | ❌ Erro: ${erros}`,
    ].join("\n")

    const suiteName = suite?.suiteName ?? "Suíte"
    const exportDate = new Date().toLocaleDateString("pt-BR")
    const content = [
      `## Histórico de Execução — ${suiteName}`,
      `*Exportado em ${exportDate}*`,
      ``,
      `---`,
      ``,
      details,
      ``,
      `---`,
      ``,
      summary,
    ].join("\n")

    navigator.clipboard.writeText(content)
    toast.success("Cole o conteúdo selecionado no Jira.", {
      description: `${selected.length} cenário${selected.length !== 1 ? "s" : ""} copiado${selected.length !== 1 ? "s" : ""} para a área de transferência.`,
    })
  }
  const [removerHistoricoOpen, setRemoverHistoricoOpen] = useState(false)
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set())
  const [addSearch, setAddSearch] = useState("")

  const filteredModules = useMemo(() => {
    return allModulos.filter(m => m.sistemaName === sistemaSelecionado)
  }, [allModulos, sistemaSelecionado])

  const existingIds = useMemo(() => new Set(cenarios.map(c => c.id)), [cenarios])

  const filteredAdd = allCenarios.filter((c) => {
    if (existingIds.has(c.id)) return false
    const searchLow = addSearch.toLowerCase().trim()
    const matchesSearch = !addSearch ||
      (c.id || "").toLowerCase().includes(searchLow) ||
      (c.scenarioName || "").toLowerCase().includes(searchLow)
    const sysSelected = (sistemaSelecionado || "").toLowerCase().trim()
    const cSys = (c.system || "").toLowerCase().trim()
    const matchesSystem = !sysSelected || cSys === sysSelected
    return matchesSearch && matchesSystem
  }).slice(0, 100)

  // Stats computed from historico (execuções and erros per cenário)
  const historicoStats = useMemo(() => {
    const stats: Record<string, { execucoes: number; erros: number }> = {}
    for (const h of historico) {
      if (!stats[h.id]) stats[h.id] = { execucoes: 0, erros: 0 }
      stats[h.id].execucoes++
      if (h.resultado === "Erro") stats[h.id].erros++
    }
    return stats
  }, [historico])

  // Historico sorted ascending by timestamp (or parsed date)
  const sortedHistorico = useMemo((): SortedHistoricoItem[] => {
    const parseDate = (s: string): number => {
      const parts = s.split("/")
      if (parts.length !== 3) return 0
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime()
    }
    return historico
      .map((h, i) => ({ ...h, _originalIdx: i }))
      .sort((a, b) => {
        if (a.timestamp !== undefined && b.timestamp !== undefined) return a.timestamp - b.timestamp
        if (a.timestamp !== undefined) return 1
        if (b.timestamp !== undefined) return -1
        return parseDate(a.data) - parseDate(b.data)
      })
  }, [historico])

  function handleRemove(id: string) {
    setRemoveId(id)
    setRemoveOpen(true)
  }

  function confirmRemove() {
    setCenarios((prev) => prev.filter((c) => c.id !== removeId))
    setRemoveOpen(false)
    toast.success("Cenário removido da suíte.")
  }

  async function handleSave() {
    if (!suiteName.trim()) { toast.error("O nome da Suíte é obrigatório."); return }
    if (!versao.trim()) { toast.error("A Versão é obrigatória."); return }
    if (!selectedModule.trim()) { toast.error("O Módulo é obrigatório."); return }
    if (!sistemaSelecionado.trim()) { toast.error("O Sistema é obrigatório."); return }
    if (!tipo) { toast.error("O Tipo é obrigatório."); return }
    if (cenarios.length === 0) { toast.error("É necessário adicionar pelo menos um cenário."); return }

    setIsSaving(true)
    try {
      const payload = {
        suiteName,
        versao,
        sistema: sistemaSelecionado,
        modulo: selectedModule,
        tipo,
        cliente: "",
        objetivo: null,
        cenarios: cenarios.map((c) => ({
          id: c.id,
          name: c.name,
          module: c.module,
          execucoes: c.execucoes,
          erros: c.erros,
          deps: c.deps,
          tipo: c.tipo,
        })),
      }

      if (mode === "create") {
        const nova = await criarSuite(payload)
        toast.success("Suíte criada com sucesso!")
        router.replace(`/suites/${nova.id}`)
      } else if (suite?.id) {
        await atualizarSuite(suite.id, payload)
        toast.success("Suíte atualizada!")
        router.refresh()
      }
    } catch (error: unknown) {
      toast.error("Erro ao salvar suíte: " + (error instanceof Error ? error.message : "Erro desconhecido"))
    } finally {
      setIsSaving(false)
    }
  }

  function addCenarios() {
    const toAdd = allCenarios.filter((c) => selectedAddIds.has(c.id)).map((c) => ({
      id: c.id,
      name: c.scenarioName,
      module: c.module,
      execucoes: c.execucoes,
      erros: c.erros,
      deps: c.suites,
      tipo: c.tipo,
    }))
    setCenarios((prev) => {
      const existing = new Set(prev.map((c) => c.id))
      return [...prev, ...toAdd.filter((c) => !existing.has(c.id))]
    })
    setSelectedAddIds(new Set())
    setAddCenarioOpen(false)
  }

  async function confirmRemoverHistorico() {
    if (!suite?.id) return
    const indicesToRemove = [...selectedHistorico]
    const previousHistorico = historico

    // Optimistic update
    const indexSet = new Set(indicesToRemove)
    setHistorico((prev) => prev.filter((_, i) => !indexSet.has(i)))
    setSelectedHistorico(new Set())
    setRemoverHistoricoOpen(false)

    try {
      await removerHistoricoSuite(suite.id, indicesToRemove)
      toast.success(
        indicesToRemove.length === 1
          ? "Registro removido do histórico."
          : `${indicesToRemove.length} registros removidos do histórico.`
      )
    } catch {
      setHistorico(previousHistorico)
      toast.error("Erro ao remover registros do histórico.")
    }
  }

  const TABS = [
    { id: "cadastro" as const,  label: "Cadastro",  badge: null, disabled: false },
    { id: "cenarios" as const,  label: "Cenários",  badge: cenarios.length, disabled: false },
    { id: "historico" as const, label: "Histórico", badge: historico.length > 0 ? historico.length : null, disabled: mode === "create" },
  ]

  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isSaving} label="Salvando suíte..." />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/suites" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Suítes
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">
            {mode === "create" ? "Nova Suíte" : (suite?.id ?? "Editar")}
          </span>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Check className="size-4" />
          {isSaving ? "Salvando..." : "Salvar Suíte"}
        </Button>
      </div>

      {/* Tab container */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-border-default">
          {TABS.map(({ id, label, badge, disabled }) => (
            <button
              key={id}
              type="button"
              onClick={() => !disabled && setActiveTab(id)}
              disabled={disabled}
              title={disabled ? "Disponível após salvar a suíte" : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-all ${
                disabled
                  ? "cursor-not-allowed border-transparent text-text-secondary/40 opacity-50"
                  : activeTab === id
                  ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
              }`}
            >
              {label}
              {badge !== null && badge > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full text-xs font-semibold min-w-4.5 h-4.5 px-1 ${
                  activeTab === id
                    ? "bg-brand-primary/15 text-brand-primary border border-brand-primary/30"
                    : "bg-neutral-grey-200 text-text-secondary"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Cadastro ── */}
        <div className={`p-5${activeTab !== "cadastro" ? " hidden" : ""}`}>
          <div className="grid grid-cols-1 gap-4">
            {/* Linha 1: Suíte */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Suíte <span className="text-destructive">*</span>
              </label>
              <Input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} />
            </div>

            {/* Linha 2: Sistema, Versão, Tipo, Módulo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Sistema <span className="text-destructive">*</span>
                </label>
                <Select value={sistemaSelecionado} disabled>
                  <SelectTrigger>
                    <SelectValue placeholder={systemList.length === 0 ? "Nenhum sistema cadastrado" : "Selecionar"} />
                  </SelectTrigger>
                  <SelectPopup>
                    {systemList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Versão <span className="text-destructive">*</span>
                </label>
                <Input value={versao} onChange={(e) => setVersao(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Tipo <span className="text-destructive">*</span>
                </label>
                <Select value={tipo} onValueChange={(v) => setTipo(v || "")}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="Sprint">Sprint</SelectItem>
                    <SelectItem value="Kanban">Kanban</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Módulo <span className="text-destructive">*</span>
                </label>
                <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v || "")}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectPopup>
                    {filteredModules.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectPopup>
                </Select>
              </div>
            </div>

            {/* Linha 3: Observações */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Observações</label>
              <textarea
                rows={3}
                placeholder="Observações..."
                className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── Cenários ── */}
        <div className={`p-5 space-y-3${activeTab !== "cenarios" ? " hidden" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-text-primary">
              Cenários: {cenarios.length}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setAddCenarioOpen(true)}>
              <Plus className="size-4" />
              Adicionar Cenário
            </Button>
          </div>

          {cenarios.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhum cenário adicionado à suíte.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-24" />
                  <col />
                  <col className="w-32" />
                  <col className="w-24" />
                  <col className="w-16" />
                  <col className="w-32" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execuções</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {cenarios.map((c) => (
                    <tr key={c.id} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={suite?.id ? `/suites/${suite.id}/${c.id}` : `/cenarios/${c.id}`}
                          className="font-medium text-brand-primary hover:underline"
                        >{c.id}</Link>
                      </td>
                      <td className="px-4 py-3 truncate font-medium text-text-primary">{c.name}</td>
                      <td className="px-4 py-3 text-text-secondary truncate">{c.module}</td>
                      <td className="px-4 py-3 text-text-secondary">{historicoStats[c.id]?.execucoes ?? 0}</td>
                      <td className="px-4 py-3 text-text-secondary">{historicoStats[c.id]?.erros ?? 0}</td>
                      <td className="px-4 py-3">
                        <CenarioTipoBadge tipo={c.tipo as CenarioTipo} />
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        {mode === "create" ? (
                          <button
                            type="button"
                            onClick={() => handleRemove(c.id)}
                            className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button type="button" className="flex size-9 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100" />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom">
                              <DropdownMenuItem>
                                <Link
                                  href={suite?.id ? `/suites/${suite.id}/${c.id}` : `/cenarios/${c.id}`}
                                  className="w-full"
                                >
                                  Executar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => handleRemove(c.id)}>
                                Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Histórico ── */}
        <div className={`p-5 space-y-3${activeTab !== "historico" ? " hidden" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-text-primary">Histórico de Testes</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedHistorico.size === 0}
                onClick={() => setRemoverHistoricoOpen(true)}
              >
                <Trash2 className="size-4" />
                Remover
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedHistorico.size === 0}
                onClick={handleExportarJira}
              >
                <ExternalLink className="size-4" />
                Exportar para o Jira
              </Button>
            </div>
          </div>

          {historico.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhuma execução registrada. O histórico será preenchido após a execução dos cenários.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-24" />
                  <col />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-28" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={sortedHistorico.length > 0 && selectedHistorico.size === sortedHistorico.length}
                        onChange={() => {
                          if (selectedHistorico.size === sortedHistorico.length) {
                            setSelectedHistorico(new Set())
                          } else {
                            setSelectedHistorico(new Set(sortedHistorico.map((h) => h._originalIdx)))
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execução</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistorico.map((h) => (
                    <tr key={`${h.id}-${h._originalIdx}`} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedHistorico.has(h._originalIdx)}
                          onChange={() => {
                            setSelectedHistorico((prev) => {
                              const next = new Set(prev)
                              if (next.has(h._originalIdx)) next.delete(h._originalIdx)
                              else next.add(h._originalIdx)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={suite?.id ? `/suites/${suite.id}/${h.id}` : `/cenarios/${h.id}`}
                          className="font-medium text-brand-primary hover:underline"
                        >{h.id}</Link>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{h.cenario}</td>
                      <td className="px-4 py-3 text-text-secondary max-w-0">
                        <span className="block truncate" title={h.module}>
                          {h.module && h.module.length > 16 ? `${h.module.slice(0, 16)}…` : (h.module || "—")}
                        </span>
                      </td>
                      <td className="px-4 py-3"><CenarioTipoBadge tipo={h.tipo as CenarioTipo} /></td>
                      <td className="px-4 py-3 text-text-secondary">{h.data}</td>
                      <td className="px-4 py-3 text-text-secondary">{h.hora ?? "—"}</td>
                      <td className="px-4 py-3"><ResultadoBadge resultado={h.resultado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={addCenarioOpen} onOpenChange={setAddCenarioOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Cenário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Buscar por código ou nome..."
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
            />
            <div className="max-h-72 overflow-y-auto border border-border-default rounded-lg">
              {filteredAdd.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-6">Nenhum cenário encontrado.</p>
              ) : filteredAdd.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border-default last:border-0 hover:bg-neutral-grey-50 cursor-pointer">
                  <Checkbox
                    checked={selectedAddIds.has(c.id)}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setSelectedAddIds((prev) => {
                        const next = new Set(prev)
                        if (checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-mono text-text-secondary">{c.id}</span>
                    <p className="text-sm font-medium text-text-primary truncate">{c.scenarioName}</p>
                  </div>
                  <div className="shrink-0">
                    <CenarioTipoBadge tipo={c.tipo as CenarioTipo} />
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" type="button" onClick={() => setAddCenarioOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={addCenarios}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover cenário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            O cenário {removeId} será removido da suite. Caso necessário, você poderá adicioná-lo novamente posteriormente.
          </p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmRemove}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removerHistoricoOpen}
        onOpenChange={setRemoverHistoricoOpen}
        title="Remover do histórico?"
        description={
          selectedHistorico.size === 1
            ? "1 registro será removido do histórico. Essa ação não pode ser desfeita."
            : `${selectedHistorico.size} registros serão removidos do histórico. Essa ação não pode ser desfeita.`
        }
        confirmLabel="Remover"
        onConfirm={confirmRemoverHistorico}
      />
    </div>
  )
}
