"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Check, Plus, MoreVertical, Trash2, ExternalLink, FileDown, Loader2, Play, Power, RefreshCw } from "lucide-react"
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
import { CancelActionButton } from "@/components/qagrotis/CancelActionButton"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import { criarSuite, atualizarSuite, removerHistoricoSuite, encerrarSuite, reabrirSuite, type SuiteRecord } from "@/lib/actions/suites"
import { buildSuiteCenarioRefByIdMap, refLabelForSuiteCenario } from "@/lib/suite-cenario-ref"
import { nomeParaTituloExportJira } from "@/lib/jira-export-nome-cenario"
import { downloadMarkdownFile, suiteMarkdownDownloadFilename } from "@/lib/suite-markdown-export"
import { type EvFile, deleteEvidenceFile, evidenceFileToBlob } from "@/lib/evidence-storage"
import { evHistoricoStorageKey, evScenarioStorageKey } from "@/lib/evidence-session-keys"
import { applyJiraAttachmentUrlsToMarkdown } from "@/lib/jira-evidence-markdown"
import { toast } from "sonner"
import { AutoResizeTextarea } from "@/components/qagrotis/AutoResizeTextarea"

/** Markdown para Jira/ADF: rótulo em negrito; multilinha em parágrafo (sem fences — evita crases na descrição). */
function jiraExportField(label: string, value: string | undefined | null): string {
  const v = (value && value.trim()) ? value.trim() : "—"
  if (v === "—") return `**${label}:** —`
  if (v.includes("\n")) {
    return `**${label}:**\n\n${v}`
  }
  return `**${label}:** ${v}`
}

export interface SuiteFormProps {
  mode: "create" | "edit"
  suite?: SuiteRecord
  systemList?: string[]
  initialSistema?: string
  allModulos?: ModuloRecord[]
  allCenarios?: CenarioRecord[]
  preloadedSuite?: { cenarios: { id: string; name: string; module: string; tipo: string; execucoes: number; erros: number }[] }
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
  resultado: "Sucesso" | "Erro" | "Pendente" | "Alerta"
  alertaObs?: string
  executadoPor?: string
}

type SortedHistoricoItem = HistoricoItem & { _originalIdx: number }


export function SuiteForm({
  mode,
  suite,
  systemList = SYSTEM_LIST,
  initialSistema,
  allModulos = [],
  allCenarios = [],
  preloadedSuite,
}: SuiteFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sistemaSelecionado: sistemaSelecionadoCtx } = useSistemaSelecionado()
  // Use context value if available, otherwise fall back to saved suite sistema
  const sistemaSelecionado = sistemaSelecionadoCtx || suite?.sistema || initialSistema || ""
  const tabParam = searchParams.get("tab")
  const initialTab = (tabParam === "cenarios" || tabParam === "historico") ? tabParam : "cadastro"
  const [activeTab, setActiveTab] = useState<"cadastro" | "cenarios" | "historico">(initialTab)
  const [cenarios, setCenarios] = useState<SuiteCenario[]>(
    suite?.cenarios ?? preloadedSuite?.cenarios?.map(c => ({
      id: c.id, name: c.name, module: c.module, tipo: c.tipo,
      execucoes: c.execucoes, erros: c.erros, deps: 0,
    })) ?? []
  )
  const [historico, setHistorico] = useState<HistoricoItem[]>(() => {
    const raw = (suite?.historico ?? []) as HistoricoItem[]
    // Sort by timestamp descending (newest first)
    return [...raw].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
  })

  const cenarioRefById = useMemo(() => buildSuiteCenarioRefByIdMap(cenarios), [cenarios])

  useEffect(() => {
    if (systemList.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de criar suítes.")
  }, [systemList.length])

  const [addCenarioOpen, setAddCenarioOpen] = useState(false)
  const [selectedCenarios, setSelectedCenarios] = useState<Set<string>>(new Set())
  const [suiteName, setSuiteName] = useState(suite?.suiteName || "")
  const [versao, setVersao] = useState(suite?.versao || "")
  const [selectedModule, setSelectedModule] = useState(suite?.modulo || "")

  /** Módulo da suíte (Cadastro) deve refletir nas tabelas Cenários e Histórico. */
  useEffect(() => {
    const m = selectedModule.trim()
    if (!m) return
    setCenarios((prev) => prev.map((c) => (c.module === m ? c : { ...c, module: m })))
    setHistorico((prev) => prev.map((h) => (h.module === m ? h : { ...h, module: m })))
  }, [selectedModule])

  const [tipo, setTipo] = useState(suite?.tipo || "")
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEncerrandoOuReabrindo, setIsEncerrandoOuReabrindo] = useState(false)
  const [encerrarOpen, setEncerrarOpen] = useState(false)
  const [encerrada, setEncerrada] = useState(suite?.encerrada ?? false)
  const [selectedHistorico, setSelectedHistorico] = useState<Set<number>>(new Set())

  function buildCenariosJiraContent(ids: Set<string>): string {
    const selected = cenarios.filter(c => ids.has(c.id))
    if (selected.length === 0) return ""
    const details = selected.map((c) => {
      const ref = refLabelForSuiteCenario(cenarioRefById, c.id)
      const cenario = allCenarios.find((ac) => ac.id === c.id)
      const titulo = nomeParaTituloExportJira({
        nomeNaSuiteOuHistorico: c.name,
        scenarioNameCadastro: cenario?.scenarioName,
      })
      const sys = cenario?.system ?? suite?.sistema
      return [
        `### ${ref} — ${titulo}`,
        ``,
        jiraExportField("Código original", c.id),
        jiraExportField("Sistema", sys),
        jiraExportField("Módulo", c.module),
        jiraExportField("Tipo", c.tipo),
        jiraExportField("Descrição", cenario?.descricao),
        jiraExportField("Regra de Negócio", cenario?.regraDeNegocio),
        jiraExportField("Pré-condições", cenario?.preCondicoes),
        jiraExportField("BDD (Gherkin)", cenario?.bdd),
        jiraExportField("Resultado esperado", cenario?.resultadoEsperado),
        `**Testes:** ${historicoStats[c.id]?.execucoes ?? 0} | **Erros:** ${historicoStats[c.id]?.erros ?? 0}`,
      ].join("\n")
    }).join("\n---\n\n")
    const exportDate = new Date().toLocaleDateString("pt-BR")
    return [
      `## Cenários de Teste — ${suite?.suiteName ?? "Suíte"}`,
      `*Exportado em ${exportDate}*`,
      ``,
      `---`,
      ``,
      details,
    ].join("\n")
  }

  function parseIssueKey(input: string): string {
    // Accept full URL or bare key
    const trimmed = input.trim()
    if (trimmed.includes("/")) return trimmed.split("/").pop() ?? trimmed
    return trimmed
  }

  async function handleJiraExport() {
    const issueKey = parseIssueKey(jiraIssueInput)
    if (!issueKey) { toast.error("Informe a URL ou chave da issue."); return }
    try {
      const cr = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      const cfg = cr.ok ? ((await cr.json()) as { configured?: boolean }) : null
      if (!cfg?.configured) {
        toast.error("Configure a Integração Jira em Configurações antes de exportar.")
        return
      }
    } catch {
      toast.error("Não foi possível verificar a integração Jira.")
      return
    }
    setJiraLoading(true)
    setJiraExisting(null)
    try {
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", issueKey }),
      })
      if (!res.ok) {
        const err = await res.text()
        toast.error(`Erro ao buscar issue: ${err.slice(0, 150)}`)
        return
      }
      const data = await res.json() as { summary: string; descText: string; hasContent: boolean; attachmentIds?: number[] }
      if (data.hasContent) {
        // Show step 2 with existing content
        setJiraExisting(data)
      } else {
        // No existing content — send directly
        await sendToJira(issueKey, "replace")
      }
    } catch {
      toast.error("Não foi possível conectar ao Jira.")
    } finally {
      setJiraLoading(false)
    }
  }

  async function sendToJira(issueKey: string, mode: "replace" | "append") {
    setJiraLoading(true)
    try {
      // Upload evidence files and replace filenames with inline image markdown
      let contentToSend = jiraContent
      if (jiraEvidences.length > 0) {
        const fd = new FormData()
        fd.append("issueKey", issueKey)
        for (const ev of jiraEvidences) {
          const blob = await evidenceFileToBlob(ev)
          fd.append("files", new File([blob], ev.name, { type: ev.type }), ev.name)
        }
        const uploadRes = await fetch("/api/jira/attachments", { method: "POST", body: fd })
        const uploadBody = (await uploadRes.json().catch(() => ({
          uploaded: [] as { name: string; contentUrl: string }[],
          errors: [] as string[],
        }))) as { uploaded: { name: string; contentUrl: string }[]; errors?: string[] }
        if (!uploadRes.ok) {
          throw new Error(uploadBody.errors?.join("; ") || `Upload de anexos falhou (${uploadRes.status}).`)
        }
        if (uploadBody.uploaded.length === 0) {
          throw new Error(uploadBody.errors?.join("; ") || "O Jira não aceitou os anexos.")
        }
        if (uploadBody.errors?.length) {
          toast.warning(`Parte dos anexos falhou: ${uploadBody.errors.slice(0, 2).join("; ")}`)
        }
        contentToSend = applyJiraAttachmentUrlsToMarkdown(contentToSend, uploadBody.uploaded)
      }

      const deleteAttachmentIds = mode === "replace" ? (jiraExisting?.attachmentIds ?? []) : []

      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey, content: contentToSend, mode, deleteAttachmentIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as string) || "Erro ao enviar para o Jira.")
      const evMsg = jiraEvidences.length > 0 ? ` ${jiraEvidences.length} evidência(s) anexada(s).` : ""
      toast.success("Exportado para o Jira com sucesso!", {
        description: `Issue ${issueKey} atualizada.${evMsg}`,
        action: { label: "Abrir no Jira", onClick: () => window.open((data as { url: string }).url, "_blank") },
      })
      setJiraModalOpen(false)
      setJiraIssueInput("")
      setJiraExisting(null)
      setJiraEvidences([])
      setSelectedHistorico(new Set())
      setSelectedCenarios(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar com o Jira.")
    } finally {
      setJiraLoading(false)
    }
  }
  const [removerHistoricoOpen, setRemoverHistoricoOpen] = useState(false)

  // ── Jira export modal ─────────────────────────────────────────────────────
  const [jiraModalOpen, setJiraModalOpen] = useState(false)
  const [jiraIssueInput, setJiraIssueInput] = useState("")  // URL completa ou chave
  const [jiraLoading, setJiraLoading] = useState(false)
  const [jiraContent, setJiraContent] = useState("")
  const [jiraEvidences, setJiraEvidences] = useState<EvFile[]>([])
  const [jiraInputTouched, setJiraInputTouched] = useState(false)
  const [jiraExisting, setJiraExisting] = useState<{ summary: string; descText: string; hasContent: boolean; attachmentIds?: number[] } | null>(null)
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set())
  const [addSearch, setAddSearch] = useState("")
  const [addModuloFilter, setAddModuloFilter] = useState("")

  const filteredModules = useMemo(() => {
    return allModulos.filter(m => m.sistemaName === sistemaSelecionado)
  }, [allModulos, sistemaSelecionado])

  const existingIds = useMemo(() => new Set(cenarios.map(c => c.id)), [cenarios])

  // Memoized active status map — O(1) lookup instead of repeated .find()
  const cenarioActiveMap = useMemo(() => {
    const map = new Map<string, boolean>()
    allCenarios.forEach((ac) => map.set(ac.id, ac.active))
    return map
  }, [allCenarios])

  const isCenarioAtivoFn = (id: string) => cenarioActiveMap.get(id) !== false

  const filteredAdd = allCenarios.filter((c) => {
    if (!c.active) return false
    if (existingIds.has(c.id)) return false
    if (sistemaSelecionado && (c.system || "").trim() !== sistemaSelecionado.trim()) return false
    // Search filter
    const searchLow = addSearch.toLowerCase().trim()
    const matchesSearch = !searchLow ||
      (c.id || "").toLowerCase().includes(searchLow) ||
      (c.scenarioName || "").toLowerCase().includes(searchLow)
    // Module filter (optional — only applied when user explicitly picks a module)
    const modSelected = (addModuloFilter || "").toLowerCase().trim()
    const cMod = (c.module || "").toLowerCase().trim()
    const matchesModule = !modSelected || cMod === modSelected
    return matchesSearch && matchesModule
  })

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

  // Historico sorted descending by timestamp (or parsed date)
  const sortedHistorico = useMemo((): SortedHistoricoItem[] => {
    const parseDate = (s: string): number => {
      const parts = s.split("/")
      if (parts.length !== 3) return 0
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime()
    }
    return historico
      .map((h, i) => ({ ...h, _originalIdx: i }))
      .sort((a, b) => {
        if (a.timestamp !== undefined && b.timestamp !== undefined) return b.timestamp - a.timestamp
        if (a.timestamp !== undefined) return -1
        if (b.timestamp !== undefined) return 1
        return parseDate(b.data) - parseDate(a.data)
      })
  }, [historico])

  function buildHistoricoExportBundle(selected: SortedHistoricoItem[]): { content: string; evidences: EvFile[] } {
    const resultIcon = (r: string) =>
      r === "Sucesso" ? "✅" : r === "Erro" ? "❌" : r === "Alerta" ? "⚠️" : "⏳"
    const allEvidences: EvFile[] = []
    const details = selected.map((h) => {
      const icon = resultIcon(h.resultado)
      const ref = refLabelForSuiteCenario(cenarioRefById, h.id)
      const cenario = allCenarios.find((c) => c.id === h.id)
      const titulo = nomeParaTituloExportJira({
        nomeNaSuiteOuHistorico: h.cenario,
        scenarioNameCadastro: cenario?.scenarioName,
      })
      const manualEvs: EvFile[] = (() => {
        try {
          if (suite?.id && h.timestamp !== undefined) {
            const k = evHistoricoStorageKey(suite.id, h.id, h.timestamp, "manual")
            const raw = sessionStorage.getItem(k)
            if (raw !== null) return JSON.parse(raw) as EvFile[]
          }
          return JSON.parse(
            sessionStorage.getItem(evScenarioStorageKey(h.id, "manual")) ?? "[]",
          ) as EvFile[]
        } catch {
          return []
        }
      })()
      const autoEvs: EvFile[] = (() => {
        try {
          if (suite?.id && h.timestamp !== undefined) {
            const k = evHistoricoStorageKey(suite.id, h.id, h.timestamp, "auto")
            const raw = sessionStorage.getItem(k)
            if (raw !== null) return JSON.parse(raw) as EvFile[]
          }
          return JSON.parse(
            sessionStorage.getItem(evScenarioStorageKey(h.id, "auto")) ?? "[]",
          ) as EvFile[]
        } catch {
          return []
        }
      })()
      allEvidences.push(...manualEvs, ...autoEvs)
      const lines = [
        `### ${ref} — ${titulo}  ${icon} ${h.resultado}`,
        ``,
        jiraExportField("Código original", h.id),
        jiraExportField("Sistema", cenario?.system ?? suite?.sistema),
        jiraExportField("Módulo", h.module),
        jiraExportField("Tipo", h.tipo),
        jiraExportField("Descrição", cenario?.descricao),
        jiraExportField("Regra de Negócio", cenario?.regraDeNegocio),
        jiraExportField("Pré-condições", cenario?.preCondicoes),
        jiraExportField("BDD (Gherkin)", cenario?.bdd),
        jiraExportField("Resultado esperado", cenario?.resultadoEsperado),
        `**Execução:** ${h.data}${h.hora ? ` às ${h.hora}` : ""}`,
        `**Resultado:** ${icon} ${h.resultado}`,
      ]
      if (h.resultado === "Alerta" && h.alertaObs?.trim()) {
        lines.push("", jiraExportField("Observações de alerta", h.alertaObs))
      }
      if (manualEvs.length > 0) {
        lines.push(``, `**Evidências — Teste Manual:**`)
        manualEvs.forEach((ev) => lines.push(`- ${ev.name}`))
      }
      if (autoEvs.length > 0) {
        lines.push(``, `**Evidências — Automação:**`)
        autoEvs.forEach((ev) => lines.push(`- ${ev.name}`))
      }
      return lines.join("\n")
    }).join("\n---\n\n")

    const tableRows = selected
      .map((h) => {
        const ref = refLabelForSuiteCenario(cenarioRefById, h.id)
        const cen = allCenarios.find((c) => c.id === h.id)
        const titulo = nomeParaTituloExportJira({
          nomeNaSuiteOuHistorico: h.cenario,
          scenarioNameCadastro: cen?.scenarioName,
        })
        return `| ${ref} | ${h.id} | ${titulo} | ${h.module || "—"} | ${resultIcon(h.resultado)} ${h.resultado} | ${h.data}${h.hora ? ` ${h.hora}` : ""} |`
      })
      .join("\n")

    const sucessos = selected.filter((h) => h.resultado === "Sucesso").length
    const erros = selected.filter((h) => h.resultado === "Erro").length
    const alertas = selected.filter((h) => h.resultado === "Alerta").length
    const summary = [
      `## Resumo da Execução`,
      ``,
      `| Ref. | Código | Cenário | Módulo | Resultado | Data/Hora |`,
      `|------|--------|---------|--------|-----------|-----------|`,
      tableRows,
      ``,
      `**Total:** ${selected.length} | ✅ Sucesso: ${sucessos} | ❌ Erro: ${erros} | ⚠️ Alerta: ${alertas}`,
    ].join("\n")

    const exportSuiteName = suite?.suiteName ?? "Suíte"
    const exportDate = new Date().toLocaleDateString("pt-BR")
    const content = [
      `## Histórico de Execução — ${exportSuiteName}`,
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
    return { content, evidences: allEvidences }
  }

  async function handleExportarJira() {
    const selected = sortedHistorico.filter((h) => selectedHistorico.has(h._originalIdx))
    if (selected.length === 0) return
    try {
      const r = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      const d = r.ok ? ((await r.json()) as { configured?: boolean }) : null
      if (!d?.configured) {
        toast.error("Configure a Integração Jira em Configurações antes de exportar.", {
          action: { label: "Configurar", onClick: () => router.push("/configuracoes") },
        })
        return
      }
    } catch {
      toast.error("Não foi possível verificar a integração Jira.")
      return
    }
    const { content, evidences } = buildHistoricoExportBundle(selected)
    setJiraContent(content)
    setJiraEvidences(evidences)
    setJiraModalOpen(true)
  }

  function handleExportarMdCenarios() {
    if (selectedCenarios.size === 0) return
    const md = buildCenariosJiraContent(selectedCenarios)
    if (!md.trim()) return
    const name = suiteMarkdownDownloadFilename(suiteName, suite?.id ?? "")
    downloadMarkdownFile(name, md)
    toast.success("Arquivo Markdown transferido.")
  }

  function handleExportarMdHistorico() {
    const selected = sortedHistorico.filter((h) => selectedHistorico.has(h._originalIdx))
    if (selected.length === 0) return
    const { content } = buildHistoricoExportBundle(selected)
    const name = suiteMarkdownDownloadFilename(suiteName, suite?.id ?? "")
    downloadMarkdownFile(name, content)
    toast.success("Arquivo Markdown transferido.")
  }

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
        // Preserve active tab after save by navigating with tab query param
        router.replace(`/suites/${suite.id}?tab=${activeTab}`)
        router.refresh()
      }
    } catch (error: unknown) {
      toast.error("Erro ao salvar suíte: " + (error instanceof Error ? error.message : "Erro desconhecido"))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmarEncerrar() {
    if (!suite?.id) return
    setEncerrarOpen(false)
    setIsEncerrandoOuReabrindo(true)
    try {
      await encerrarSuite(suite.id)
      setEncerrada(true)
      toast.success("Suíte encerrada.")
    } catch {
      toast.error("Não foi possível encerrar a suíte. Tente novamente.")
    } finally {
      setIsEncerrandoOuReabrindo(false)
    }
  }

  async function handleReabrir() {
    if (!suite?.id) return
    setIsEncerrandoOuReabrindo(true)
    try {
      await reabrirSuite(suite.id)
      setEncerrada(false)
      toast.success("Suíte reaberta.")
    } catch {
      toast.error("Não foi possível reabrir a suíte. Tente novamente.")
    } finally {
      setIsEncerrandoOuReabrindo(false)
    }
  }

  function addCenarios() {
    const mod = selectedModule.trim()
    const toAdd = allCenarios.filter((c) => selectedAddIds.has(c.id)).map((c) => ({
      id: c.id,
      name: c.scenarioName,
      module: mod || c.module,
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

  // ── Auto-save when cenarios change (only for existing suites with ID) ────────
  const isFirstRender = React.useRef(true)
  const autoSaveTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Skip on first render — we don't want to save immediately on mount
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Only auto-save for existing suites (edit mode with an ID) that are not encerrada
    if (mode !== "edit" || !suite?.id || encerrada) return

    // Debounce to avoid multiple rapid saves
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
    autoSaveTimeout.current = setTimeout(async () => {
      try {
        await atualizarSuite(suite.id, {
          suiteName,
          versao,
          sistema: sistemaSelecionado,
          modulo: selectedModule,
          tipo,
          cliente: "",
          objetivo: null,
          cenarios: cenarios.map((c) => ({
            id: c.id, name: c.name, module: c.module,
            execucoes: c.execucoes, erros: c.erros, deps: c.deps, tipo: c.tipo,
          })),
        })
        toast.success("Suíte salva automaticamente.", { duration: 2000 })
      } catch {
        // Silent fail — user can still save manually
      }
    }, 600)

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cenarios])

  async function confirmRemoverHistorico() {
    if (!suite?.id) return
    const indicesToRemove = [...selectedHistorico]
    const previousHistorico = historico

    for (const idx of indicesToRemove) {
      const h = previousHistorico[idx]
      if (h.timestamp === undefined) continue
      for (const tipo of ["manual", "auto"] as const) {
        const key = evHistoricoStorageKey(suite.id, h.id, h.timestamp, tipo)
        const raw = sessionStorage.getItem(key)
        try {
          const list = (raw ? JSON.parse(raw) : []) as EvFile[]
          for (const ev of list) void deleteEvidenceFile(ev)
        } catch { /* ignore */ }
        sessionStorage.removeItem(key)
      }
    }

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
        {encerrada ? (
          <Button
            variant="outline"
            onClick={handleReabrir}
            disabled={isEncerrandoOuReabrindo}
          >
            {isEncerrandoOuReabrindo ? "Reabrindo..." : "Editar Suíte"}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {mode === "edit" && suite?.id && (
              <Button
                variant="destructive"
                onClick={() => setEncerrarOpen(true)}
                disabled={isSaving || isEncerrandoOuReabrindo}
              >
                <Power className="size-4" />
                Encerrar Suíte
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || isEncerrandoOuReabrindo}>
              <Check className="size-4" />
              {isSaving ? "Salvando..." : "Salvar Suíte"}
            </Button>
          </div>
        )}
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
              <Input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} disabled={encerrada} />
            </div>

            {/* Linha 2: Sistema, Versão, Tipo, Módulo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Sistema <span className="text-destructive">*</span>
                </label>
                <Select value={sistemaSelecionado} disabled={true}>
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
                <Input value={versao} onChange={(e) => setVersao(e.target.value)} disabled={encerrada} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Tipo</label>
                <Select value={tipo} onValueChange={(v) => setTipo(v || "")} disabled={encerrada}>
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
                <Select value={selectedModule} onValueChange={(v) => setSelectedModule(v || "")} disabled={encerrada}>
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
              <AutoResizeTextarea
                placeholder="Observações..."
                disabled={encerrada}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        {/* ── Cenários ── */}
        <div className={activeTab !== "cenarios" ? "hidden" : ""}>
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border-default px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedCenarios.size === 0}
              onClick={handleExportarMdCenarios}
            >
              <FileDown className="size-4" />
              Exportar.md
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedCenarios.size === 0}
              onClick={() => {
                setJiraContent(buildCenariosJiraContent(selectedCenarios))
                setJiraEvidences([])
                setJiraModalOpen(true)
              }}
            >
              <ExternalLink className="size-4" />
              Exportar para o Jira
            </Button>
            {!encerrada && (
              <Button variant="outline" size="sm" onClick={() => setAddCenarioOpen(true)}>
                <Plus className="size-4" />
                Adicionar Cenário
              </Button>
            )}
          </div>

          {cenarios.length === 0 ? (
            <div className="mx-5 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhum cenário adicionado à suíte.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="qagrotis-table-row-hover w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col />
                  <col className="w-32" />
                  <col className="w-24" />
                  <col className="w-16" />
                  <col className="w-32" />
                  <col className="w-24" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={cenarios.length > 0 && selectedCenarios.size === cenarios.length}
                        onChange={() => {
                          if (selectedCenarios.size === cenarios.length) setSelectedCenarios(new Set())
                          else setSelectedCenarios(new Set(cenarios.map(c => c.id)))
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ref.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Testes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {cenarios.map((c) => {
                    const isCenarioAtivo = isCenarioAtivoFn(c.id)
                    const refLabel = refLabelForSuiteCenario(cenarioRefById, c.id)
                    return (
                    <tr key={c.id} className={`border-b border-border-default last:border-0 transition-colors${!isCenarioAtivo ? " opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedCenarios.has(c.id)}
                          onChange={() => {
                            setSelectedCenarios(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return next
                            })
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isCenarioAtivo ? (
                          <Link
                            href={suite?.id ? `/suites/${suite.id}/${c.id}` : `/cenarios/${c.id}`}
                            className="font-medium text-brand-primary hover:underline"
                          >{c.id}</Link>
                        ) : (
                          <Link
                            href={suite?.id ? `/suites/${suite.id}/${c.id}` : `/cenarios/${c.id}`}
                            className="font-medium text-text-secondary hover:underline"
                          >{c.id}</Link>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-border-default bg-neutral-grey-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary tabular-nums">
                          {refLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 truncate text-text-primary">
                        <span className="flex items-center gap-2">
                          {c.name}
                          {!isCenarioAtivo && (
                            <span className="shrink-0 rounded-full bg-neutral-grey-200 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                              Inativo
                            </span>
                          )}
                        </span>
                      </td>
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
                        ) : (() => {
                          const cenarioAtivo = isCenarioAtivoFn(c.id)
                          const href = suite?.id ? `/suites/${suite.id}/${c.id}` : `/cenarios/${c.id}`
                          return (
                            <div className="flex items-center justify-end gap-4">
                              {cenarioAtivo && !encerrada && (
                                <Link
                                  href={href}
                                  aria-label="Testar Cenário"
                                  title="Testar Cenário"
                                  className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                                >
                                  <Play className="size-4" />
                                </Link>
                              )}
                              {(!encerrada || !cenarioAtivo) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <button
                                        type="button"
                                        aria-label="Mais ações"
                                        className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-neutral-grey-100"
                                      />
                                    }
                                  >
                                    <MoreVertical className="size-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" side="bottom">
                                    {!cenarioAtivo && (
                                      <DropdownMenuItem>
                                        <Link href={href} className="w-full">Visualizar</Link>
                                      </DropdownMenuItem>
                                    )}
                                    {!encerrada && (
                                      <DropdownMenuItem variant="destructive" onClick={() => handleRemove(c.id)}>
                                        Remover
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Histórico ── */}
        <div className={activeTab !== "historico" ? "hidden" : ""}>
          <div className="flex items-center justify-end gap-2 border-b border-border-default px-5 py-3">
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
              onClick={handleExportarMdHistorico}
            >
              <FileDown className="size-4" />
              Exportar.md
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

          {historico.length === 0 ? (
            <div className="mx-5 my-6 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhuma execução registrada. O histórico será preenchido após a execução dos cenários.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="qagrotis-table-row-hover w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-28" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ref.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execução</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistorico.map((h) => {
                    // Inativo no histórico se: removido da suíte OU inativo no banco
                    const hAtivo2 = existingIds.has(h.id) && isCenarioAtivoFn(h.id)
                    const refLabel = refLabelForSuiteCenario(cenarioRefById, h.id)
                    return (
                    <tr key={`${h.id}-${h._originalIdx}`} className={`border-b border-border-default last:border-0 transition-colors${!hAtivo2 ? " opacity-60" : ""}`}>
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
                        {existingIds.has(h.id) ? (() => {
                          const hAtivo = isCenarioAtivoFn(h.id)
                          return hAtivo ? (
                            <Link
                              href={suite?.id ? `/suites/${suite.id}/${h.id}` : `/cenarios/${h.id}`}
                              className="font-medium text-brand-primary hover:underline"
                            >{h.id}</Link>
                          ) : (
                            <Link
                              href={`/cenarios/${h.id}`}
                              className="font-medium text-text-secondary hover:underline"
                            >{h.id}</Link>
                          )
                        })() : (
                          // Cenário removido da suíte: exibe ID sem link mas como texto
                          <span className="font-medium text-text-secondary">{h.id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-border-default bg-neutral-grey-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary tabular-nums">
                          {refLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        <span className="flex items-center gap-2">
                          {h.cenario}
                          {!existingIds.has(h.id) && (
                            <span className="shrink-0 rounded-full bg-neutral-grey-200 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                              Removido
                            </span>
                          )}
                          {existingIds.has(h.id) && !isCenarioAtivoFn(h.id) && (
                            <span className="shrink-0 rounded-full bg-neutral-grey-200 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                              Inativo
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary max-w-0">
                        <span className="block truncate" title={h.module}>
                          {h.module && h.module.length > 16 ? `${h.module.slice(0, 16)}…` : (h.module || "—")}
                        </span>
                      </td>
                      <td className="px-4 py-3"><CenarioTipoBadge tipo={h.tipo as CenarioTipo} /></td>
                      <td className="px-4 py-3 text-text-secondary">
                        {h.timestamp ? new Date(h.timestamp).toLocaleDateString("pt-BR") : h.data}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {h.timestamp
                          ? new Date(h.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                          : (h.hora ?? "—")}
                      </td>
                      <td className="px-4 py-3"><ResultadoBadge resultado={h.resultado} /></td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={addCenarioOpen} onOpenChange={(open) => { setAddCenarioOpen(open); if (!open) { setAddSearch(""); setAddModuloFilter(""); setSelectedAddIds(new Set()) } }}>
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar Cenário</DialogTitle></DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Módulo</label>
                <Select value={addModuloFilter} onValueChange={(v) => setAddModuloFilter(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Todos os módulos" /></SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="">Todos os módulos</SelectItem>
                    {filteredModules.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Buscar</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                    />
                  </div>
                  {selectedAddIds.size > 0 && (
                    <span className="shrink-0 text-xs font-medium text-brand-primary">
                      {selectedAddIds.size} selecionado{selectedAddIds.size !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-default">
              {filteredAdd.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">Nenhum cenário encontrado.</p>
              ) : filteredAdd.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-border-default px-3 py-2.5 last:border-0 hover:bg-neutral-grey-50">
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
                    <span className="font-mono text-xs text-text-secondary">{c.id}</span>
                    <p className="truncate text-sm font-medium text-text-primary">{c.scenarioName}</p>
                  </div>
                  <div className="shrink-0">
                    <CenarioTipoBadge tipo={c.tipo as CenarioTipo} />
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => setAddCenarioOpen(false)} />
            <Button type="button" onClick={addCenarios}>
              <Plus className="size-4 shrink-0" />
              Adicionar
            </Button>
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
            <CancelActionButton onClick={() => setRemoveOpen(false)} />
            <Button variant="destructive" onClick={confirmRemove}>
              <Trash2 className="size-4 shrink-0" />
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={encerrarOpen} onOpenChange={setEncerrarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar suíte?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            A suíte ficará <strong>Concluída</strong> e bloqueada para edição. Para reabrir, use{" "}
            <strong>Editar Suíte</strong>.
          </p>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton autoFocus onClick={() => setEncerrarOpen(false)} />
            <Button
              variant="destructive"
              onClick={handleConfirmarEncerrar}
              disabled={isEncerrandoOuReabrindo}
            >
              <Power className="size-4 shrink-0" />
              {isEncerrandoOuReabrindo ? "Encerrando..." : "Encerrar"}
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

      {/* ── Jira Modal — Passo 1: URL/Chave ── */}
      <Dialog open={jiraModalOpen && !jiraExisting} onOpenChange={(v) => { if (!v) { setJiraModalOpen(false); setJiraIssueInput(""); setJiraInputTouched(false) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar para o Jira</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                URL ou chave da issue <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="https://agrotis.atlassian.net/browse/UX-951 ou UX-951"
                value={jiraIssueInput}
                onChange={(e) => setJiraIssueInput(e.target.value)}
                onBlur={() => setJiraInputTouched(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && !jiraLoading) handleJiraExport() }}
                autoFocus
              />
              {jiraInputTouched && !jiraIssueInput.trim() && (
                <p className="text-xs text-destructive">Campo obrigatório.</p>
              )}
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => { setJiraModalOpen(false); setJiraIssueInput("") }} />
            <Button onClick={handleJiraExport} disabled={jiraLoading || !jiraIssueInput.trim()}>
              {jiraLoading
                ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                : <ExternalLink className="size-4 shrink-0" aria-hidden />}
              {jiraLoading ? "Verificando..." : "Exportar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Jira Modal — Passo 2: Conteúdo existente ── */}
      <Dialog open={jiraModalOpen && jiraExisting !== null} onOpenChange={(v) => { if (!v) { setJiraExisting(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{jiraExisting?.summary || parseIssueKey(jiraIssueInput)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-text-secondary">
              Esta issue já possui conteúdo na descrição. Como deseja prosseguir?
            </p>
            <div className="max-h-40 overflow-y-auto rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                {(jiraExisting?.descText ?? "").length > 800
                  ? (jiraExisting?.descText ?? "").slice(0, 800) + "..."
                  : (jiraExisting?.descText ?? "")}
              </pre>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => setJiraExisting(null)} disabled={jiraLoading} />
            <Button
              variant="outline"
              onClick={() => { void sendToJira(parseIssueKey(jiraIssueInput), "replace") }}
              disabled={jiraLoading}
            >
              {jiraLoading
                ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                : <RefreshCw className="size-4 shrink-0" aria-hidden />}
              {jiraLoading ? "Enviando..." : "Substituir"}
            </Button>
            <Button
              onClick={() => { void sendToJira(parseIssueKey(jiraIssueInput), "append") }}
              disabled={jiraLoading}
            >
              {jiraLoading
                ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                : <ExternalLink className="size-4 shrink-0" aria-hidden />}
              {jiraLoading ? "Enviando..." : "Acrescentar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
