"use client"

import React, { useCallback, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, Check, Circle, Plus, Trash2, X } from "lucide-react"
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
import { MOCK_CENARIOS } from "@/lib/qagrotis-constants"
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

export default function EditarCenarioClient({ cenario, initialModulos = [], allSistemas = [], initialClientes = [] }: Props) {
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

  const [scenarioName, setScenarioName] = useState(cenario.scenarioName)
  const [regraDeNegocio, setRegraDeNegocio] = useState(cenario.regraDeNegocio ?? "")
  const [objetivo, setObjetivo] = useState(cenario.objetivo ?? "")
  const [preCondicoes, setPreCondicoes] = useState(cenario.preCondicoes ?? "")
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
      const found = MOCK_CENARIOS.find((c) => c.id === id)
      return found
        ? { id: found.id, name: found.scenarioName, module: found.module, system: found.system }
        : { id, name: id, module: "", system: "" }
    })
  )
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [addDepOpen, setAddDepOpen] = useState(false)
  const [addClienteOpen, setAddClienteOpen] = useState(false)
  const [stepAcao, setStepAcao] = useState("")
  const [stepResultado, setStepResultado] = useState("")
  const [depSearch, setDepSearch] = useState("")
  const [selectedDepIds, setSelectedDepIds] = useState<Set<string>>(new Set())
  const [newClienteName, setNewClienteName] = useState("")
  const [newClienteCpf, setNewClienteCpf] = useState("")

  const filteredDepCenarios = useMemo(() => {
    const q = depSearch.toLowerCase()
    return MOCK_CENARIOS.filter(
      (c) => c.id !== cenario.id && (!q || c.id.toLowerCase().includes(q) || c.scenarioName.toLowerCase().includes(q))
    ).slice(0, 10)
  }, [depSearch, cenario.id])

  const addStep = useCallback(() => {
    if (!stepAcao || !stepResultado) return
    setSteps((prev) => [
      ...prev,
      { id: Date.now(), acao: stepAcao, resultado: stepResultado },
    ])
    setStepAcao("")
    setStepResultado("")
    setAddStepOpen(false)
  }, [stepAcao, stepResultado])

  function handleSave() {
    if (!scenarioName.trim()) { toast.error("Nome do cenário é obrigatório."); return }
    if (!moduloValue) { toast.error("Módulo é obrigatório."); return }
    if (!risco) { toast.error("Risco é obrigatório."); return }
    if (!regraDeNegocio.trim()) { toast.error("Regra de Negócio é obrigatória."); return }
    if (!objetivo.trim()) { toast.error("Objetivo é obrigatório."); return }

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
          objetivo: objetivo.trim(),
          preCondicoes: preCondicoes.trim(),
          tipo,
          urlScript: urlScript.trim(),
          steps: steps.map((s) => ({ acao: s.acao, resultado: s.resultado })),
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
    const newDeps = MOCK_CENARIOS.filter((c) => selectedDepIds.has(c.id)).map((c) => ({
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
    setAddDepOpen(false)
  }, [selectedDepIds])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/cenarios" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href={`/cenarios/${cenario.id}`} className="text-text-secondary hover:text-brand-primary">
            {cenario.id}
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Editar</span>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Check className="size-4" />
          {isSaving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-4 lg:col-span-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Cenário <span className="text-destructive">*</span>
            </label>
            <Input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Nome do cenário"
            />
          </div>

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
                  setClienteSelecionado(v ?? "")
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
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
            <label className="text-sm font-medium text-text-primary">
              Objetivo <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="Objetivo do teste..."
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

          <div className="flex items-center gap-6">
            {[
              { label: "Manual", checked: manual, toggle: () => setManual((v) => !v) },
              { label: "Automatizado", checked: automatizado, toggle: () => setAutomatizado((v) => !v) },
            ].map(({ label, checked, toggle }) => (
              <label key={label} className="flex cursor-pointer select-none items-center gap-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={toggle}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-1 ${
                    checked ? "bg-brand-primary" : "bg-neutral-grey-500"
                  }`}
                >
                  <span
                    className={`inline-block size-6 shrink-0 rounded-full bg-[#ffffff] transition-transform duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.35)] ${
                      checked ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm text-text-primary">{label}</span>
              </label>
            ))}
          </div>

          {automatizado && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Script</label>
              <Input
                value={urlScript}
                onChange={(e) => setUrlScript(e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text-primary">Passo a Passo</h2>
              <button
                type="button"
                onClick={() => setAddStepOpen(true)}
                className="text-sm text-brand-primary hover:underline"
              >
                Adicionar
              </button>
            </div>
            {steps.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhum passo adicionado.</p>
            ) : (
              <div className="space-y-2">
                {steps.map((s, idx) => (
                  <div key={s.id} className="rounded-lg border border-border-default p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Passo {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setSteps((prev) => prev.filter((x) => x.id !== s.id))}
                        className="flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
                      >
                        <Trash2 className="size-4 text-white" style={{ color: "#ffffff" }} />
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Ação</p>
                      <p className="text-sm text-text-primary">{s.acao}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary">Resultado esperado</p>
                      <p className="text-sm text-text-primary">{s.resultado}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text-primary">Dependências</h2>
              <button
                type="button"
                onClick={() => setAddDepOpen(true)}
                className="text-sm text-brand-primary hover:underline"
              >
                Adicionar
              </button>
            </div>
            {deps.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma dependência adicionada.</p>
            ) : (
              <div className="space-y-2">
                {deps.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border-default p-3 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <Link href={`/cenarios/${d.id}`} className="text-sm font-medium text-brand-primary hover:underline">
                        {d.id} → {d.system} → {d.module}
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeps((prev) => prev.filter((x) => x.id !== d.id))}
                        className="flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
                      >
                        <Trash2 className="size-4 text-white" style={{ color: "#ffffff" }} />
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary">{d.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={addStepOpen} onOpenChange={setAddStepOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Passo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Ação <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Acessar menu Cadastros > Produtores"
                value={stepAcao}
                onChange={(e) => setStepAcao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Resultado esperado <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Tela de listagem com botão novo"
                value={stepResultado}
                onChange={(e) => setStepResultado(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setAddStepOpen(false)}>Cancelar</Button>
            <Button onClick={addStep}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDepOpen} onOpenChange={setAddDepOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Dependência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Buscar cenário..."
              value={depSearch}
              onChange={(e) => setDepSearch(e.target.value)}
            />
            <div className="max-h-60 overflow-y-auto space-y-1 border border-border-default rounded-lg p-2">
              {filteredDepCenarios.map((c) => (
                <label key={c.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-neutral-grey-50 cursor-pointer">
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
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {c.id} - {c.system} → {c.module}
                    </p>
                    <p className="text-xs text-text-secondary">{c.scenarioName}</p>
                  </div>
                </label>
              ))}
            </div>
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
