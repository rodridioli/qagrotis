"use client"

import React, { useCallback, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, Bot, Check, Circle, ClipboardList, FileDown, GripVertical, LayoutList, Network, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { ClienteCombobox } from "@/components/qagrotis/ClienteCombobox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { criarModulo, type ModuloRecord } from "@/lib/actions/modulos"
import { criarCliente, type ClienteRecord } from "@/lib/actions/clientes"
import type { SistemaRecord } from "@/lib/actions/sistemas"
import { criarCenario, type CenarioRecord } from "@/lib/actions/cenarios"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { formatCpfCnpj } from "@/lib/utils"
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"

const RISCO_OPTIONS = [
  { value: "Alto",  label: "Alto",  icon: <ArrowUp   className="size-3.5 shrink-0" />,                         color: "#ef4444" },
  { value: "Médio", label: "Médio", icon: <Circle    className="size-3.5 shrink-0 fill-amber-400" />,           color: "#f59e0b" },
  { value: "Baixo", label: "Baixo", icon: <ArrowDown className="size-3.5 shrink-0" />,                         color: "#3b82f6" },
]

type TabId = "cadastro" | "manual" | "automatizado" | "dependencias"

const TAB_ICONS: Record<TabId, React.ElementType> = {
  cadastro: LayoutList,
  manual: ClipboardList,
  automatizado: Bot,
  dependencias: Network,
}

interface Props {
  initialModulos?: ModuloRecord[]
  allSistemas?: SistemaRecord[]
  initialClientes?: ClienteRecord[]
  allCenarios?: CenarioRecord[]
}

interface Step {
  id: number
  acao: string
  resultado: string
}

interface Dep {
  id: string
  name: string
  module: string
  system: string
  tipo: string
}

const TEXTAREA_CLASS =
  "w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"

export default function NovoCenarioClient({
  initialModulos = [],
  allSistemas = [],
  initialClientes = [],
  allCenarios = [],
}: Props) {
  const router = useRouter()
  const { sistemaSelecionado } = useSistemaSelecionado()
  const [localModulos, setLocalModulos] = useState<ModuloRecord[]>(initialModulos)
  const modulosDosistema = useMemo(
    () => localModulos.filter((m) => m.sistemaName === sistemaSelecionado),
    [localModulos, sistemaSelecionado]
  )

  // ── Cadastro fields ──────────────────────────────────────────────────────────
  const [moduloValue, setModuloValue] = useState("")
  const [moduloSelectOpen, setModuloSelectOpen] = useState(false)
  const [risco, setRisco] = useState("")
  const riscoSelecionado = RISCO_OPTIONS.find((r) => r.value === risco)
  const [clientes, setClientes] = useState<ClienteRecord[]>(initialClientes)
  const [clienteSelecionado, setClienteSelecionado] = useState("")
  const [scenarioName, setScenarioName] = useState("")

  // ── Switches ─────────────────────────────────────────────────────────────────
  const [manual, setManual] = useState(false)
  const [automatizado, setAutomatizado] = useState(false)

  // ── Teste Manual fields ──────────────────────────────────────────────────────
  const [descricao, setDescricao] = useState("")
  const [regraDeNegocio, setRegraDeNegocio] = useState("")
  // Shared between manual and automatizado:
  const [preCondicoes, setPreCondicoes] = useState("")
  const [bdd, setBdd] = useState("")
  const [resultadoEsperado, setResultadoEsperado] = useState("")

  // ── Teste Automatizado fields ────────────────────────────────────────────────
  const [urlAmbiente, setUrlAmbiente] = useState("")
  const [usuarioTeste, setUsuarioTeste] = useState("")
  const [senhaTeste, setSenhaTeste] = useState("")
  const [objetivo, setObjetivo] = useState("")
  const [urlScript, setUrlScript] = useState("")
  const [steps, setSteps] = useState<Step[]>([])
  const draggedStepId = useRef<number | null>(null)

  // ── Deps ─────────────────────────────────────────────────────────────────────
  const [deps, setDeps] = useState<Dep[]>([])

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("cadastro")

  // ── Save state ───────────────────────────────────────────────────────────────
  const [isSaving, startSaveTransition] = useTransition()
  const [hasSaved, setHasSaved] = useState(false)
  const [savedId, setSavedId] = useState("")

  // ── Loading for sub-operations ───────────────────────────────────────────────
  const [isClientePending, startClienteTransition] = useTransition()
  const [isModuloPending, startModuloTransition] = useTransition()
  const [isDepSearchPending, startDepSearchTransition] = useTransition()

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [noModuloOpen, setNoModuloOpen] = useState(false)
  const [noModuloNome, setNoModuloNome] = useState("")
  const [addDepOpen, setAddDepOpen] = useState(false)
  const [addClienteOpen, setAddClienteOpen] = useState(false)
  const [newClienteName, setNewClienteName] = useState("")
  const [newClienteCpf, setNewClienteCpf] = useState("")

  // ── Dep search state ─────────────────────────────────────────────────────────
  const [depSearchInput, setDepSearchInput] = useState("")
  const [depSearch, setDepSearch] = useState("")
  const [depSistema, setDepSistema] = useState("")
  const [depModulo, setDepModulo] = useState("")
  const [selectedDepIds, setSelectedDepIds] = useState<Set<string>>(new Set())

  const depModulos = useMemo(
    () => localModulos.filter((m) => m.active && m.sistemaName === depSistema),
    [localModulos, depSistema]
  )
  const existingDepIds = useMemo(() => new Set(deps.map((d) => d.id)), [deps])

  const DEP_LIMIT = 50
  const filteredDepCenarios = useMemo(() => {
    if (!depSistema || !depModulo) return { items: [], total: 0 }
    const q = depSearch.toLowerCase()
    const all = allCenarios.filter(
      (c) =>
        c.system === depSistema &&
        c.module === depModulo &&
        !existingDepIds.has(c.id) &&
        (!q || c.id.toLowerCase().includes(q) || c.scenarioName.toLowerCase().includes(q))
    )
    return { items: all.slice(0, DEP_LIMIT), total: all.length }
  }, [allCenarios, depSistema, depModulo, depSearch, existingDepIds])

  // ── Switch toggles — stay on cadastro tab ──────────────────────────────────
  function toggleManual() {
    const next = !manual
    setManual(next)
    if (!next) {
      if (activeTab === "manual") setActiveTab("cadastro")
      if (!automatizado && activeTab === "dependencias") setActiveTab("cadastro")
    }
  }

  function toggleAutomatizado() {
    const next = !automatizado
    setAutomatizado(next)
    if (!next) {
      if (activeTab === "automatizado") setActiveTab("cadastro")
      if (!manual && activeTab === "dependencias") setActiveTab("cadastro")
    }
  }

  // ── Visible tabs ─────────────────────────────────────────────────────────────
  const visibleTabs: { id: TabId; label: string; badge: number | null; disabled?: boolean }[] = [
    { id: "cadastro",     label: "Cadastro",           badge: null },
    { id: "manual",       label: "Teste Manual",       badge: null, disabled: !manual },
    { id: "automatizado", label: "Teste Automatizado", badge: steps.length > 0 ? steps.length : null, disabled: !automatizado },
    { id: "dependencias", label: "Dependências",       badge: deps.length > 0 ? deps.length : null, disabled: !(manual || automatizado) },
  ]

  // ── Steps ────────────────────────────────────────────────────────────────────
  function addStepRow() {
    setHasSaved(false)
    setSteps((prev) => [...prev, { id: Date.now(), acao: "", resultado: "" }])
  }

  function updateStep(id: number, field: "acao" | "resultado", value: string) {
    setHasSaved(false)
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  function handleStepDragOver(e: React.DragEvent, targetId: number) {
    e.preventDefault()
    const fromId = draggedStepId.current
    if (fromId === null || fromId === targetId) return
    setSteps((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === fromId)
      const toIdx = prev.findIndex((s) => s.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave(): Promise<boolean> {
    if (!moduloValue) { toast.error("Módulo é obrigatório."); setActiveTab("cadastro"); return false }
    if (!risco) { toast.error("Risco é obrigatório."); setActiveTab("cadastro"); return false }
    if (!manual && !automatizado) { toast.error("É obrigatório habilitar pelo menos um tipo: Manual ou Automatizado."); setActiveTab("cadastro"); return false }
    if (!scenarioName.trim()) { toast.error("Nome do cenário é obrigatório."); setActiveTab(manual ? "manual" : "automatizado"); return false }

    if (manual) {
      if (!descricao.trim()) { toast.error("Descrição é obrigatória."); setActiveTab("manual"); return false }
      if (!resultadoEsperado.trim()) { toast.error("Resultado Esperado é obrigatório."); setActiveTab("manual"); return false }
    }

    if (automatizado) {
      if (!urlAmbiente.trim()) { toast.error("URL do Ambiente é obrigatória."); setActiveTab("automatizado"); return false }
      if (!usuarioTeste.trim()) { toast.error("Usuário é obrigatório."); setActiveTab("automatizado"); return false }
      if (!senhaTeste.trim()) { toast.error("Senha é obrigatória."); setActiveTab("automatizado"); return false }
      if (!resultadoEsperado.trim()) { toast.error("Resultado Esperado é obrigatório."); setActiveTab("automatizado"); return false }
      if (steps.filter((s) => s.acao.trim() && s.resultado.trim()).length === 0) {
        toast.error("Adicione pelo menos 1 passo com ação e resultado.")
        setActiveTab("automatizado")
        return false
      }
    }

    const tipo: "Manual" | "Automatizado" | "Man./Auto." =
      manual && automatizado ? "Man./Auto." : automatizado ? "Automatizado" : "Manual"

    return new Promise((resolve) => {
      startSaveTransition(async () => {
        try {
          const novo = await criarCenario({
            scenarioName: scenarioName.trim(),
            system: sistemaSelecionado,
            module: moduloValue,
            client: clienteSelecionado,
            risco,
            regraDeNegocio: regraDeNegocio.trim(),
            descricao: descricao.trim(),
            caminhoTela: "",
            preCondicoes: preCondicoes.trim(),
            bdd: bdd.trim(),
            resultadoEsperado: resultadoEsperado.trim(),
            tipo,
            urlAmbiente: urlAmbiente.trim(),
            objetivo: objetivo.trim(),
            urlScript: urlScript.trim(),
            usuarioTeste: usuarioTeste.trim(),
            senhaTeste: senhaTeste.trim(),
            senhaFalsa: "",
            steps: steps
              .map((s) => ({ acao: s.acao.trim(), resultado: s.resultado.trim() }))
              .filter((s) => s.acao.length > 0 && s.resultado.length > 0),
            deps: deps.map((d) => d.id),
          })
          setSavedId(novo.id)
          setHasSaved(true)
          toast.success("Cenário criado com sucesso.")
          router.push(`/cenarios/${novo.id}/editar`)
          resolve(true)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Erro ao salvar cenário.")
          resolve(false)
        }
      })
    })
  }

  // ── Prompt.md export ─────────────────────────────────────────────────────────
  async function exportarPrompt() {
    const saved = await handleSave()
    if (!saved) return

    const id = savedId || "CT-???"
    const preconLinhas = preCondicoes
      .split(/\n+/)
      .map((l) => l.replace(/^[-*\s]+/, "").trim())
      .filter(Boolean)
    const preconFormatado = preconLinhas.length
      ? preconLinhas.map((l) => `- ${l}`).join("\n")
      : "- Acessar o sistema."

    const linhasPassos = steps
      .filter((s) => s.acao.trim())
      .map((s, i) => `| ${i + 1} | ${s.acao.trim()} | ${s.resultado.trim()} |`)

    const resultadoLinhas = resultadoEsperado
      .split(/\n+/)
      .map((l) => l.replace(/^[-*\s]+/, "").trim())
      .filter(Boolean)
    const resultadoRows = resultadoLinhas.length
      ? resultadoLinhas.map((l) => `| **${l}** | Sucesso ✅ |`)
      : [`| **${resultadoEsperado.trim()}** | Sucesso ✅ |`]

    const md = [
      `---`,
      ``,
      `## **${id}: ${scenarioName}**`,
      ``,
      `#### **Objetivo**`,
      ``,
      objetivo.trim() || "Não informado.",
      ``,
      `#### **Pré-condições**`,
      ``,
      preconFormatado,
      ``,
      `#### **Passos**`,
      ``,
      `| **Id** | **Ação** | **Resultado Esperado** |`,
      `| ------ | -------- | ---------------------- |`,
      ...linhasPassos,
      ``,
      `#### **Resultados**`,
      ``,
      `| **Resultado Obtido** | **Status** |`,
      `| -------------------- | ---------- |`,
      ...resultadoRows,
    ].join("\n")

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "prompt.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Arquivo prompt.md gerado com sucesso.")
  }

  const showPromptBtn =
    hasSaved &&
    automatizado &&
    urlAmbiente.trim() !== "" &&
    usuarioTeste.trim() !== "" &&
    senhaTeste.trim() !== "" &&
    resultadoEsperado.trim() !== "" &&
    steps.some((s) => s.acao.trim() && s.resultado.trim())

  // ── Deps ─────────────────────────────────────────────────────────────────────
  const addDeps = useCallback(() => {
    const newDeps = allCenarios
      .filter((c) => selectedDepIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.scenarioName, module: c.module, system: c.system, tipo: c.tipo }))
    setDeps((prev) => {
      const existing = new Set(prev.map((d) => d.id))
      return [...prev, ...newDeps.filter((d) => !existing.has(d.id))]
    })
    setSelectedDepIds(new Set())
    setDepSistema("")
    setDepModulo("")
    setDepSearchInput("")
    setDepSearch("")
    setAddDepOpen(false)
  }, [allCenarios, selectedDepIds])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <LoadingOverlay visible={isSaving} label="Salvando cenário..." />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/cenarios" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Novo Cenário</span>
        </div>
        <div className="flex items-center gap-3">
          {showPromptBtn && (
            <Button variant="outline" onClick={exportarPrompt} disabled={isSaving}>
              <FileDown className="size-4" />
              Prompt.md
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Check className="size-4" />
            {isSaving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Tab card */}
      <div className="rounded-xl bg-surface-card shadow-card">

        {/* Tab nav */}
        <div className="flex border-b border-border-default overflow-hidden rounded-t-xl">
          {visibleTabs.map(({ id, label, badge, disabled }) => {
            const Icon = TAB_ICONS[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                disabled={disabled}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 -mb-px px-2 sm:px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === id
                    ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                    : disabled
                    ? "border-transparent text-text-secondary/40 cursor-not-allowed bg-transparent"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className={activeTab === id ? "" : "hidden sm:inline"}>{label}</span>
                {badge !== null && badge > 0 && (
                  <span className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                    activeTab === id
                      ? "border border-brand-primary/30 bg-brand-primary/15 text-brand-primary"
                      : disabled
                      ? "bg-neutral-grey-100 text-text-secondary/40"
                      : "bg-neutral-grey-200 text-text-secondary"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Cadastro tab ── */}
        <div className={`p-5 space-y-4${activeTab !== "cadastro" ? " hidden" : ""}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Sistema <span className="text-destructive">*</span>
              </label>
              <Input value={sistemaSelecionado} disabled />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Módulo <span className="text-destructive">*</span>
              </label>
              <Select
                value={moduloValue}
                onValueChange={(v) => setModuloValue(v ?? "")}
                open={moduloSelectOpen}
                onOpenChange={(open) => {
                  if (open && modulosDosistema.length === 0) {
                    toast.warning(`O sistema "${sistemaSelecionado}" não possui módulos cadastrados.`)
                    setNoModuloOpen(true)
                    return
                  }
                  setModuloSelectOpen(open)
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  {modulosDosistema.map((m) => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Cliente</label>
              <ClienteCombobox
                clientes={clientes}
                value={clienteSelecionado}
                onChange={setClienteSelecionado}
                onAddCliente={() => setAddClienteOpen(true)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Risco <span className="text-destructive">*</span>
              </label>
              <Select value={risco} onValueChange={(v) => setRisco(v ?? "")}>
                <SelectTrigger>
                  {riscoSelecionado ? (
                    <span className="flex items-center gap-1.5" style={{ color: riscoSelecionado.color }}>
                      <span>{riscoSelecionado.icon}</span>
                      {riscoSelecionado.label}
                    </span>
                  ) : (
                    <span className="text-text-secondary">Selecionar</span>
                  )}
                </SelectTrigger>
                <SelectPopup>
                  {RISCO_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-1.5" style={{ color: r.color }}>
                        <span>{r.icon}</span>
                        {r.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          {/* Tipo de teste — toggle switches */}
          <div className="rounded-lg border border-border-default bg-neutral-grey-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">Tipo de teste</p>
            <div className="flex flex-wrap items-center gap-6">
              {[
                { label: "Manual", checked: manual, toggle: toggleManual, id: "switch-manual" },
                { label: "Automatizado", checked: automatizado, toggle: toggleAutomatizado, id: "switch-auto" },
              ].map(({ label, checked, toggle, id }) => (
                <label key={id} className="flex cursor-pointer select-none items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    id={id}
                    aria-checked={checked}
                    onClick={toggle}
                    className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-1"
                    style={{ background: checked ? "var(--brand-primary)" : "#94a3b8" }}
                  >
                    <span
                      className={`inline-block size-4 shrink-0 rounded-full transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
                      style={{ background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" }}
                    />
                  </button>
                  <span className="text-sm text-text-primary">{label}</span>
                </label>
              ))}
            </div>
            {!manual && !automatizado && (
              <p className="mt-2 text-xs text-text-secondary">
                Habilite pelo menos um tipo para continuar.
              </p>
            )}
          </div>
        </div>

        {/* ── Teste Manual tab ── */}
        {manual && (
          <div className={`p-5 space-y-4${activeTab !== "manual" ? " hidden" : ""}`}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Cenário <span className="text-destructive">*</span>
              </label>
              <Input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Nome do cenário de teste"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Descrição <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição do cenário de teste..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Regra de Negócio</label>
              <textarea
                rows={2}
                value={regraDeNegocio}
                onChange={(e) => setRegraDeNegocio(e.target.value)}
                placeholder="Descreva a regra de negócio..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Pré-condições</label>
              <textarea
                rows={2}
                value={preCondicoes}
                onChange={(e) => setPreCondicoes(e.target.value)}
                placeholder="Pré-condições necessárias..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">BDD (Gherkin)</label>
              <textarea
                rows={4}
                value={bdd}
                onChange={(e) => setBdd(e.target.value)}
                placeholder={`Dado que o usuário está na tela de...\nQuando ele realiza a ação...\nEntão o sistema deve...`}
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Resultado Esperado <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                value={resultadoEsperado}
                onChange={(e) => setResultadoEsperado(e.target.value)}
                placeholder="Descreva o resultado esperado..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>
          </div>
        )}

        {/* ── Teste Automatizado tab ── */}
        {automatizado && (
          <div className={`p-5 space-y-5${activeTab !== "automatizado" ? " hidden" : ""}`}>
            {/* Cenário name — also needed when only automatizado is on */}
            {!manual && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Cenário <span className="text-destructive">*</span>
                </label>
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Nome do cenário de teste"
                />
              </div>
            )}

            {/* Credentials */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Credenciais</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-lg border border-border-default bg-neutral-grey-50 p-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    URL do Ambiente <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={urlAmbiente}
                    onChange={(e) => { setUrlAmbiente(e.target.value); setHasSaved(false) }}
                    placeholder="https://app.exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Usuário <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={usuarioTeste}
                    onChange={(e) => { setUsuarioTeste(e.target.value); setHasSaved(false) }}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-primary">
                    Senha <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={senhaTeste}
                    onChange={(e) => { setSenhaTeste(e.target.value); setHasSaved(false) }}
                    placeholder="Senha de acesso"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border-default" />

            {/* Objetivo */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Objetivo</label>
              <textarea
                rows={2}
                value={objetivo}
                onChange={(e) => { setObjetivo(e.target.value); setHasSaved(false) }}
                placeholder="Descreva o objetivo do teste..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            {/* Pré-condições */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Pré-condições</label>
              <textarea
                rows={2}
                value={preCondicoes}
                onChange={(e) => { setPreCondicoes(e.target.value); setHasSaved(false) }}
                placeholder="Pré-condições necessárias..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            {/* Passo a passo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Passo a passo <span className="text-destructive">*</span>
                </h3>
                <Button variant="outline" size="sm" onClick={addStepRow}>
                  <Plus className="size-4" />
                  Adicionar passo
                </Button>
              </div>
              {steps.length === 0 ? (
                <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-8 text-center text-sm text-text-secondary">
                  Nenhum passo adicionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-default">
                        <th className="w-8 py-2" />
                        <th className="w-8 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-text-secondary">Ação</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold text-text-secondary">Resultado esperado</th>
                        <th className="w-8 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {steps.map((s, idx) => (
                        <tr
                          key={s.id}
                          draggable
                          onDragStart={() => { draggedStepId.current = s.id }}
                          onDragOver={(e) => handleStepDragOver(e, s.id)}
                          onDragEnd={() => { draggedStepId.current = null }}
                          className="group border-b border-border-default last:border-0"
                        >
                          <td className="cursor-grab py-1.5 pr-1 active:cursor-grabbing">
                            <GripVertical className="size-4 text-text-secondary opacity-40 transition-opacity group-hover:opacity-100" />
                          </td>
                          <td className="w-8 py-1.5 text-xs font-medium text-text-secondary">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <input
                              value={s.acao}
                              onChange={(e) => updateStep(s.id, "acao", e.target.value)}
                              placeholder="Descreva a ação..."
                              className="w-full rounded-custom border border-border-default bg-surface-input px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={s.resultado}
                              onChange={(e) => updateStep(s.id, "resultado", e.target.value)}
                              placeholder="Resultado esperado..."
                              className="w-full rounded-custom border border-border-default bg-surface-input px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </td>
                          <td className="py-1.5 pl-1">
                            <button
                              type="button"
                              onClick={() => { setHasSaved(false); setSteps((prev) => prev.filter((x) => x.id !== s.id)) }}
                              className="flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
                            >
                              <Trash2 className="size-4" style={{ color: "white" }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Resultado Esperado */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Resultado Esperado <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={2}
                value={resultadoEsperado}
                onChange={(e) => { setResultadoEsperado(e.target.value); setHasSaved(false) }}
                placeholder="Descreva o resultado esperado do teste automatizado..."
                onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
                className={TEXTAREA_CLASS}
              />
            </div>

            {/* URL do Script */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Script</label>
              <Input
                value={urlScript}
                onChange={(e) => { setUrlScript(e.target.value); setHasSaved(false) }}
                placeholder="https://github.com/..."
              />
            </div>
          </div>
        )}

        {/* ── Dependências tab ── */}
        {(manual || automatizado) && (
          <div className={activeTab !== "dependencias" ? "hidden" : ""}>
            <div className="flex justify-end px-5 pt-5 pb-3">
              <Button variant="outline" size="sm" onClick={() => setAddDepOpen(true)}>
                <Plus className="size-4" />
                Adicionar dependência
              </Button>
            </div>
            {deps.length === 0 ? (
              <div className="mx-5 mb-5 rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
                Nenhuma dependência adicionada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-24" /><col /><col className="w-28" /><col className="w-40" /><col className="w-40" /><col className="w-10" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistema</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {deps.map((d) => (
                      <tr key={d.id} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                        <td className="px-4 py-3">
                          <Link href={`/cenarios/${d.id}`} className="font-medium text-brand-primary hover:underline">{d.id}</Link>
                        </td>
                        <td className="px-4 py-3 text-text-primary truncate">{d.name}</td>
                        <td className="px-4 py-3"><CenarioTipoBadge tipo={d.tipo as CenarioTipo} /></td>
                        <td className="px-4 py-3 text-text-secondary truncate">{d.system}</td>
                        <td className="px-4 py-3 text-text-secondary truncate">{d.module}</td>
                        <td className="py-3 pl-2 pr-4">
                          <button
                            type="button"
                            onClick={() => setDeps((prev) => prev.filter((x) => x.id !== d.id))}
                            className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialog: Adicionar Dependência ── */}
      <Dialog open={addDepOpen} onOpenChange={(open) => {
        if (!open) { setDepSistema(""); setDepModulo(""); setDepSearchInput(""); setDepSearch(""); setSelectedDepIds(new Set()) }
        else if (allSistemas.filter((s) => s.active).length === 0) {
          toast.warning("É preciso cadastrar um sistema com seus respectivos módulos e cenários.")
        }
        setAddDepOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Adicionar Dependência</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Sistema</label>
                <Select
                  value={depSistema}
                  disabled={allSistemas.filter((s) => s.active).length === 0}
                  onValueChange={(v) => {
                    const val = v ?? ""
                    setDepSistema(val); setDepModulo(""); setDepSearchInput(""); setDepSearch("")
                    if (!localModulos.some((m) => m.active && m.sistemaName === val))
                      toast.warning(`É preciso cadastrar um módulo dentro do sistema "${val}".`)
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar sistema" /></SelectTrigger>
                  <SelectPopup>
                    {allSistemas.filter((s) => s.active).map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Módulo</label>
                <Select
                  value={depModulo}
                  onValueChange={(v) => { setDepModulo(v ?? ""); setDepSearchInput(""); setDepSearch("") }}
                  disabled={!depSistema || depModulos.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar módulo" /></SelectTrigger>
                  <SelectPopup>
                    {depModulos.map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
            {depSistema && depModulo && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar por código ou nome..."
                      value={depSearchInput}
                      onChange={(e) => {
                        const v = e.target.value
                        setDepSearchInput(v)
                        startDepSearchTransition(() => setDepSearch(v))
                      }}
                    />
                  </div>
                  {selectedDepIds.size > 0 && (
                    <span className="shrink-0 text-xs font-medium text-brand-primary">
                      {selectedDepIds.size} selecionado{selectedDepIds.size !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border-default">
                  {isDepSearchPending ? (
                    <p className="py-6 text-center text-sm text-text-secondary">Buscando...</p>
                  ) : filteredDepCenarios.items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-text-secondary">Nenhum cenário encontrado.</p>
                  ) : (
                    <>
                      {filteredDepCenarios.total > DEP_LIMIT && (
                        <p className="border-b border-border-default px-3 pb-1 pt-2 text-xs text-text-secondary">
                          Mostrando {DEP_LIMIT} de {filteredDepCenarios.total} — refine a busca.
                        </p>
                      )}
                      {filteredDepCenarios.items.map((c) => (
                        <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-border-default px-3 py-2.5 last:border-0 hover:bg-neutral-grey-50">
                          <Checkbox
                            checked={selectedDepIds.has(c.id)}
                            onChange={() => {
                              setSelectedDepIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(c.id)) next.delete(c.id)
                                else next.add(c.id)
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
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setAddDepOpen(false)}>Cancelar</Button>
            <Button onClick={addDeps} disabled={selectedDepIds.size === 0}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar Cliente ── */}
      <Dialog open={addClienteOpen} onOpenChange={setAddClienteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Cliente <span className="text-destructive">*</span>
              </label>
              <Input placeholder="Nome do cliente" value={newClienteName} onChange={(e) => setNewClienteName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">CPF/CNPJ</label>
              <Input
                placeholder="000.000.000-00"
                value={newClienteCpf}
                onChange={(e) => setNewClienteCpf(formatCpfCnpj(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setAddClienteOpen(false)}>Cancelar</Button>
            <Button
              disabled={isClientePending}
              onClick={() => {
                if (!newClienteName.trim()) return
                const duplicate = clientes.some(
                  (c) => c.nomeFantasia.trim().toLowerCase() === newClienteName.trim().toLowerCase()
                )
                if (duplicate) {
                  toast.error("Cliente já cadastrado.")
                  return
                }
                startClienteTransition(async () => {
                  const novo = await criarCliente({ nomeFantasia: newClienteName, razaoSocial: null, cpfCnpj: newClienteCpf || null })
                  setClientes((prev) => [...prev, novo])
                  setClienteSelecionado(novo.nomeFantasia)
                  setNewClienteName("")
                  setNewClienteCpf("")
                  setAddClienteOpen(false)
                })
              }}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nenhum módulo cadastrado ── */}
      <Dialog open={noModuloOpen} onOpenChange={setNoModuloOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nenhum módulo cadastrado</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-secondary">
              O sistema <span className="font-medium text-text-primary">{sistemaSelecionado}</span> não tem módulos vinculados. Adicione um módulo para continuar.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Nome do módulo <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Ex: Financeiro, Estoque..."
                value={noModuloNome}
                onChange={(e) => setNoModuloNome(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setNoModuloOpen(false)}>Cancelar</Button>
            <Button
              disabled={isModuloPending}
              onClick={() => {
                if (!noModuloNome.trim()) return
                const sistema = allSistemas.find((s) => s.name === sistemaSelecionado)
                if (!sistema) return
                startModuloTransition(async () => {
                  const novo = await criarModulo({ name: noModuloNome, description: null, sistemaId: sistema.id, sistemaName: sistema.name })
                  setLocalModulos((prev) => [...prev, novo])
                  setModuloValue(novo.name)
                  setNoModuloNome("")
                  setNoModuloOpen(false)
                })
              }}
            >
              <Plus className="size-4" />
              Adicionar Módulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
