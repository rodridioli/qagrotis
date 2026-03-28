"use client"

import React, { useCallback, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, Check, Circle, GripVertical, Plus, Trash2, X } from "lucide-react"
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
import { atualizarCenario, type CenarioRecord } from "@/lib/actions/cenarios"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import { formatCpfCnpj } from "@/lib/utils"

const RISCO_OPTIONS = [
  {
    value: "Alto",
    label: "Alto",
    icon: <ArrowUp className="size-3.5 shrink-0" />,
    color: "#ef4444",
  },
  {
    value: "Médio",
    label: "Médio",
    icon: <Circle className="size-3.5 shrink-0 fill-amber-400" />,
    color: "#f59e0b",
  },
  {
    value: "Baixo",
    label: "Baixo",
    icon: <ArrowDown className="size-3.5 shrink-0" />,
    color: "#3b82f6",
  },
]

interface Props {
  cenario: CenarioRecord
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
}

export default function EditarCenarioClient({ cenario, initialModulos = [], allSistemas = [], initialClientes = [], allCenarios = [] }: Props) {
  const router = useRouter()
  const { sistemaSelecionado } = useSistemaSelecionado()
  const [localModulos, setLocalModulos] = useState<ModuloRecord[]>(initialModulos)
  const modulosDosistema = useMemo(
    () => localModulos.filter((m) => m.sistemaName === sistemaSelecionado),
    [localModulos, sistemaSelecionado]
  )

  const [risco, setRisco] = useState(cenario.risco ?? "")
  const riscoSelecionado = RISCO_OPTIONS.find((r) => r.value === risco)

  const [clientes, setClientes] = useState<ClienteRecord[]>(initialClientes)
  const [clienteSelecionado, setClienteSelecionado] = useState(cenario.client ?? "")
  const [isSaving, startSaveTransition] = useTransition()
  const [isClientePending, startClienteTransition] = useTransition()
  const [isModuloPending, startModuloTransition] = useTransition()
  const [isDepSearchPending, startDepSearchTransition] = useTransition()

  const [scenarioName, setScenarioName] = useState(cenario.scenarioName)
  const [descricao, setDescricao] = useState(cenario.descricao ?? "")
  const [caminhoTela, setCaminhoTela] = useState(cenario.caminhoTela ?? "")
  const [regraDeNegocio, setRegraDeNegocio] = useState(cenario.regraDeNegocio ?? "")
  const [preCondicoes, setPreCondicoes] = useState(cenario.preCondicoes ?? "")
  const [bdd, setBdd] = useState(cenario.bdd ?? "")
  const [resultadoEsperado, setResultadoEsperado] = useState(cenario.resultadoEsperado ?? "")
  const [urlScript, setUrlScript] = useState(cenario.urlScript ?? "")

  const [noModuloOpen, setNoModuloOpen] = useState(false)
  const [noModuloNome, setNoModuloNome] = useState("")
  const [moduloSelectOpen, setModuloSelectOpen] = useState(false)
  const [moduloValue, setModuloValue] = useState(cenario.module ?? "")

  const initialTipo = cenario.tipo ?? "Manual"
  const [manual, setManual] = useState(initialTipo === "Manual" || initialTipo === "Man./Auto.")
  const [automatizado, setAutomatizado] = useState(initialTipo === "Automatizado" || initialTipo === "Man./Auto.")

  const [steps, setSteps] = useState<Step[]>(
    (cenario.steps ?? []).map((s, i) => ({ id: i + 1, acao: s.acao, resultado: s.resultado }))
  )
  const [deps, setDeps] = useState<Dep[]>(
    (cenario.deps ?? []).map((id) => {
      const found = allCenarios.find((c) => c.id === id)
      return found
        ? { id: found.id, name: found.scenarioName, module: found.module, system: found.system }
        : { id, name: id, module: "", system: "" }
    })
  )
  const [addDepOpen, setAddDepOpen] = useState(false)
  const [addClienteOpen, setAddClienteOpen] = useState(false)
  const draggedStepId = useRef<number | null>(null)
  const [activeTab, setActiveTab] = useState<"cadastro" | "passos" | "dependencias">("cadastro")
  const [depSearchInput, setDepSearchInput] = useState("")
  const [depSearch, setDepSearch] = useState("")
  const [depSistema, setDepSistema] = useState("")
  const [depModulo, setDepModulo] = useState("")
  const [selectedDepIds, setSelectedDepIds] = useState<Set<string>>(new Set())
  const [newClienteName, setNewClienteName] = useState("")
  const [newClienteCpf, setNewClienteCpf] = useState("")

  const depModulos = useMemo(
    () => localModulos.filter((m) => m.active && m.sistemaName === depSistema),
    [localModulos, depSistema]
  )

  const DEP_LIMIT = 50
  const filteredDepCenarios = useMemo(() => {
    if (!depSistema || !depModulo) return { items: [], total: 0 }
    const q = depSearch.toLowerCase()
    const all = allCenarios.filter(
      (c) =>
        c.system === depSistema &&
        c.module === depModulo &&
        (!q || c.id.toLowerCase().includes(q) || c.scenarioName.toLowerCase().includes(q))
    )
    return { items: all.slice(0, DEP_LIMIT), total: all.length }
  }, [allCenarios, depSistema, depModulo, depSearch])

  function addStepRow() {
    setSteps((prev) => [...prev, { id: Date.now(), acao: "", resultado: "" }])
  }

  function updateStep(id: number, field: "acao" | "resultado", value: string) {
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

  function handleSave() {
    if (!scenarioName.trim()) { toast.error("Nome do cenário é obrigatório."); return }
    if (!moduloValue) { toast.error("Módulo é obrigatório."); return }
    if (!risco) { toast.error("Risco é obrigatório."); return }
    if (!manual && !automatizado) { toast.error("É obrigatório habilitar pelo menos um tipo: Manual ou Automatizado."); return }
    if (automatizado && !urlScript.trim()) { toast.error("URL do Script é obrigatória quando Automatizado está habilitado."); return }
    if (!descricao.trim()) { toast.error("Descrição é obrigatória."); return }
    if (!regraDeNegocio.trim()) { toast.error("Regra de Negócio é obrigatória."); return }
    if (!resultadoEsperado.trim()) { toast.error("Resultado Esperado é obrigatório."); return }

    const tipo: "Manual" | "Automatizado" | "Man./Auto." =
      manual && automatizado ? "Man./Auto." : automatizado ? "Automatizado" : "Manual"

    startSaveTransition(async () => {
      try {
        await atualizarCenario(cenario.id, {
          scenarioName: scenarioName.trim(),
          system: sistemaSelecionado || cenario.system,
          module: moduloValue,
          client: clienteSelecionado,
          risco,
          regraDeNegocio: regraDeNegocio.trim(),
          descricao: descricao.trim(),
          caminhoTela: caminhoTela.trim(),
          preCondicoes: preCondicoes.trim(),
          bdd: bdd.trim(),
          resultadoEsperado: resultadoEsperado.trim(),
          tipo,
          urlScript: urlScript.trim(),
          steps: steps
            .map((s) => ({ acao: s.acao.trim(), resultado: s.resultado.trim() }))
            .filter((s) => s.acao.length > 0 && s.resultado.length > 0),
          deps: deps.map((d) => d.id),
        })
        toast.success("Cenário atualizado com sucesso.")
        router.push("/cenarios")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao salvar cenário.")
      }
    })
  }

  const addDeps = useCallback(() => {
    const newDeps = allCenarios.filter((c) => selectedDepIds.has(c.id)).map((c) => ({
      id: c.id,
      name: c.scenarioName,
      module: c.module,
      system: c.system,
    }))
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/cenarios" title="Voltar" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">{cenario.id} - Editar</span>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Check className="size-4" />
          {isSaving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-border-default">
          {(["cadastro", "passos", "dependencias"] as const).map((tab) => {
            const label = tab === "cadastro" ? "Cadastro" : tab === "passos" ? "Passo a Passo" : "Dependências"
            const badge = tab === "passos" ? steps.length : tab === "dependencias" ? deps.length : null
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex flex-1 items-center justify-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-all ${
                  activeTab === tab
                    ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
                }`}
              >
                {label}
                {badge !== null && badge > 0 && (
                  <span className={`inline-flex items-center justify-center rounded-full text-xs font-semibold min-w-4.5 h-4.5 px-1 ${
                    activeTab === tab
                      ? "bg-brand-primary/15 text-brand-primary border border-brand-primary/30"
                      : "bg-neutral-grey-200 text-text-secondary"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Cadastro ── */}
        <div className={`p-5 space-y-4${activeTab !== "cadastro" ? " hidden" : ""}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Sistema <span className="text-destructive">*</span>
              </label>
              <Input value={sistemaSelecionado || cenario.system} disabled />
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
                    toast.warning(`O sistema "${sistemaSelecionado || cenario.system}" não possui módulos cadastrados. Cadastre um módulo para continuar.`)
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
              <Select
                value={clienteSelecionado}
                onValueChange={(v: string | null) => {
                  if (v === "__add__") { setAddClienteOpen(true); return }
                  if (v === "__none__") { setClienteSelecionado(""); return }
                  setClienteSelecionado(v ?? "")
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="__none__" className="text-text-secondary">Nenhum</SelectItem>
                  <div className="my-1 border-t border-border-default" />
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.nomeFantasia}>{c.nomeFantasia}</SelectItem>
                  ))}
                  <div className="my-1 border-t border-border-default" />
                  <SelectItem value="__add__" className="text-brand-primary hover:text-brand-primary font-medium">
                    + Adicionar Cliente
                  </SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Risco <span className="text-destructive">*</span>
              </label>
              <Select value={risco} onValueChange={(v) => setRisco(v ?? "")}>
                <SelectTrigger>
                  {riscoSelecionado ? (
                    <span
                      className="flex items-center gap-1.5 font-bold"
                      style={{ color: riscoSelecionado.color }}
                    >
                      <span style={{ color: riscoSelecionado.color }}>{riscoSelecionado.icon}</span>
                      {riscoSelecionado.label}
                    </span>
                  ) : (
                    <span className="text-text-secondary">Selecionar</span>
                  )}
                </SelectTrigger>
                <SelectPopup>
                  {RISCO_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span
                        className="flex items-center gap-1.5 font-bold"
                        style={{ color: r.color }}
                      >
                        <span style={{ color: r.color }}>{r.icon}</span>
                        {r.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Cenário <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Nome do cenário"
                />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {[
                  { label: "Manual", checked: manual, toggle: () => setManual((v) => !v) },
                  { label: "Automatizado", checked: automatizado, toggle: () => setAutomatizado((v) => !v) },
                ].map(({ label, checked, toggle }) => (
                  <label key={label} className="flex cursor-pointer select-none items-center gap-1.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      onClick={toggle}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-1 ${
                        checked ? "bg-brand-primary" : "bg-neutral-grey-400"
                      }`}
                    >
                      <span
                        className={`inline-block size-4 shrink-0 rounded-full bg-[#ffffff] transition-transform duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${
                          checked ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className="text-sm text-text-primary">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {automatizado && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                URL do Script <span className="text-destructive">*</span>
              </label>
              <Input
                value={urlScript}
                onChange={(e) => setUrlScript(e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
          )}

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
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Caminho da Tela</label>
            <Input
              value={caminhoTela}
              onChange={(e) => setCaminhoTela(e.target.value)}
              placeholder="Ex: Menu > Cadastros > Produtores"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Regra de Negócio <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              value={regraDeNegocio}
              onChange={(e) => setRegraDeNegocio(e.target.value)}
              placeholder="Descreva a regra de negócio..."
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"
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
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">BDD (Gherkin)</label>
            <textarea
              rows={4}
              value={bdd}
              onChange={(e) => setBdd(e.target.value)}
              placeholder={`DADO O contexto inicial (ex: "Dado que o cliente está logado").\nQUANDO A ação realizada (ex: "Quando ele adiciona um item ao carrinho").\nENTÃO O resultado esperado (ex: "Então o item deve aparecer na tela de checkout")`}
              onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px` }}
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"
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
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none overflow-hidden"
            />
          </div>
        </div>

        {/* ── Passo a Passo ── */}
        <div className={`p-5 space-y-3${activeTab !== "passos" ? " hidden" : ""}`}>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={addStepRow}>
              <Plus className="size-4" />
              Adicionar passo
            </Button>
          </div>
          {steps.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhum passo adicionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="w-8 py-2" />
                    <th className="w-8 py-2 text-left text-xs font-semibold text-text-secondary">#</th>
                    <th className="py-2 text-left text-xs font-semibold text-text-secondary px-2">Ação</th>
                    <th className="py-2 text-left text-xs font-semibold text-text-secondary px-2">Resultado esperado</th>
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
                      className="border-b border-border-default last:border-0 group"
                    >
                      <td className="py-1.5 pr-1 cursor-grab active:cursor-grabbing">
                        <GripVertical className="size-4 text-text-secondary opacity-40 group-hover:opacity-100 transition-opacity" />
                      </td>
                      <td className="py-1.5 text-xs font-medium text-text-secondary w-8">{idx + 1}</td>
                      <td className="py-1.5 px-2">
                        <input
                          value={s.acao}
                          onChange={(e) => updateStep(s.id, "acao", e.target.value)}
                          placeholder="Descreva a ação..."
                          className="w-full rounded-custom border border-border-default bg-surface-input px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </td>
                      <td className="py-1.5 px-2">
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
                          onClick={() => setSteps((prev) => prev.filter((x) => x.id !== s.id))}
                          className="flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
                        >
                          <Trash2 className="size-4" style={{ color: "#ffffff" }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Dependências ── */}
        <div className={`${activeTab !== "dependencias" ? "hidden" : ""}`}>
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
                  <col className="w-28" />
                  <col />
                  <col className="w-1/4" />
                  <col className="w-1/4" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistema</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {deps.map((d) => (
                    <tr key={d.id} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                      <td className="px-4 py-3">
                        <Link href={`/cenarios/${d.id}`} className="font-medium text-brand-primary hover:underline">
                          {d.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-primary truncate">{d.name}</td>
                      <td className="px-4 py-3 text-text-secondary truncate">{d.system}</td>
                      <td className="px-4 py-3 text-text-secondary truncate">{d.module}</td>
                      <td className="py-3 pl-2 pr-4">
                        <button
                          type="button"
                          title="Remover dependência"
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
      </div>

      <Dialog open={addDepOpen} onOpenChange={(open) => {
        if (!open) { setDepSistema(""); setDepModulo(""); setDepSearchInput(""); setDepSearch(""); setSelectedDepIds(new Set()) }
        else if (allSistemas.filter((s) => s.active).length === 0) {
          toast.warning("É preciso cadastrar um sistema com seus respectivos módulos e cenários.")
        }
        setAddDepOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Dependência</DialogTitle>
          </DialogHeader>
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
                    const hasModulos = localModulos.some((m) => m.active && m.sistemaName === val)
                    if (!hasModulos) toast.warning(`É preciso cadastrar um módulo dentro do sistema "${val}" e seus respectivos cenários.`)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar sistema" />
                  </SelectTrigger>
                  <SelectPopup>
                    {allSistemas.filter((s) => s.active).map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Módulo</label>
                <Select value={depModulo} onValueChange={(v) => { setDepModulo(v ?? ""); setDepSearchInput(""); setDepSearch("") }} disabled={!depSistema || depModulos.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar módulo" />
                  </SelectTrigger>
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
                <div className="max-h-72 overflow-y-auto border border-border-default rounded-lg">
                  {isDepSearchPending ? (
                    <p className="text-sm text-text-secondary text-center py-6">Buscando...</p>
                  ) : filteredDepCenarios.items.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-6">Nenhum cenário encontrado.</p>
                  ) : (
                    <>
                      {filteredDepCenarios.total > DEP_LIMIT && (
                        <p className="px-3 pt-2 pb-1 text-xs text-text-secondary border-b border-border-default">
                          Mostrando {DEP_LIMIT} de {filteredDepCenarios.total} — refine a busca para ver mais.
                        </p>
                      )}
                      {filteredDepCenarios.items.map((c) => (
                        <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-border-default last:border-0 hover:bg-neutral-grey-50 cursor-pointer">
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
                          <div className="min-w-0">
                            <span className="text-xs font-mono text-text-secondary">{c.id}</span>
                            <p className="text-sm font-medium text-text-primary truncate">{c.scenarioName}</p>
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
            <Button onClick={addDeps}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addClienteOpen} onOpenChange={setAddClienteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Cliente <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Nome do cliente"
                value={newClienteName}
                onChange={(e) => setNewClienteName(e.target.value)}
              />
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
                startClienteTransition(async () => {
                  const novo = await criarCliente({
                    nomeFantasia: newClienteName,
                    razaoSocial: null,
                    cpfCnpj: newClienteCpf || null,
                  })
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

      <Dialog open={noModuloOpen} onOpenChange={setNoModuloOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nenhum módulo cadastrado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-text-secondary">
              O sistema <span className="font-medium text-text-primary">{sistemaSelecionado}</span> ainda
              não tem módulos vinculados. Adicione pelo menos um módulo para poder cadastrar cenários neste sistema.
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
                const sistema = allSistemas.find((s) => s.name === (sistemaSelecionado || cenario.system))
                if (!sistema) return
                startModuloTransition(async () => {
                  const novo = await criarModulo({
                    name: noModuloNome,
                    description: null,
                    sistemaId: sistema.id,
                    sistemaName: sistema.name,
                  })
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
