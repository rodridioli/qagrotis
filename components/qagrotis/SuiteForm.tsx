"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Plus, MoreVertical, Trash2, X } from "lucide-react"
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
import {
  MODULE_LIST,
  SYSTEM_LIST,
  MOCK_CENARIOS,
  type MockSuite,
} from "@/lib/qagrotis-constants"
import { CenarioTipoBadge, StatusBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"

export interface SuiteFormProps {
  mode: "create" | "edit"
  suite?: MockSuite
  systemList?: string[]
}
import { toast } from "sonner"

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
  resultado: "Sucesso" | "Erro" | "Pendente"
}

function ResultadoBadge({ resultado }: { resultado: HistoricoItem["resultado"] }) {
  const map: Record<string, string> = {
    Sucesso:  "border-green-600/30 bg-green-600/10 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400",
    Erro:     "border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400",
    Pendente: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400",
  }
  return <StatusBadge label={resultado} colorClass={map[resultado]} />
}

const MOCK_HISTORICO: HistoricoItem[] = [
  { id: "CT-001", cenario: "Cadastro de Produtores", module: "Cadastros", tipo: "Automatizado", deps: 1, data: "12/02/2026 10:00", resultado: "Sucesso" },
  { id: "CT-005", cenario: "Login e Autenticação", module: "Users", tipo: "Manual", deps: 0, data: "12/02/2026 10:30", resultado: "Erro" },
  { id: "CT-010", cenario: "Consulta de Estoque", module: "Estoque", tipo: "Man./Auto.", deps: 2, data: "12/02/2026 11:00", resultado: "Pendente" },
]

const INITIAL_CENARIOS: SuiteCenario[] = [
  { id: "CT-001", name: "Cadastro de Produtores", module: "Cadastros", execucoes: 12, erros: 1, deps: 1, tipo: "Automatizado" },
  { id: "CT-005", name: "Login e Autenticação", module: "Users", execucoes: 8, erros: 0, deps: 0, tipo: "Manual" },
]

export function SuiteForm({ mode, suite, systemList = SYSTEM_LIST }: SuiteFormProps) {
  const [cenarios, setCenarios] = useState<SuiteCenario[]>(mode === "edit" ? INITIAL_CENARIOS : [])

  useEffect(() => {
    if (systemList.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de criar suítes.")
  }, [])
  const [cenarioSearch, setCenarioSearch] = useState("")
  const [addCenarioOpen, setAddCenarioOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>(["ERP"])
  const [tagInput, setTagInput] = useState("")
  const [selectedHistorico, setSelectedHistorico] = useState<Set<string>>(new Set())
  const [selectedAddIds, setSelectedAddIds] = useState<Set<string>>(new Set())
  const [addSearch, setAddSearch] = useState("")

  const filteredAdd = MOCK_CENARIOS.filter((c) =>
    !addSearch ||
    c.id.toLowerCase().includes(addSearch.toLowerCase()) ||
    c.scenarioName.toLowerCase().includes(addSearch.toLowerCase())
  ).slice(0, 10)

  function handleRemove(id: string) {
    setRemoveId(id)
    setRemoveOpen(true)
  }

  function confirmRemove() {
    setCenarios((prev) => prev.filter((c) => c.id !== removeId))
    setRemoveOpen(false)
    toast.success("Cenário removido da suíte.")
  }

  function addCenarios() {
    const toAdd = MOCK_CENARIOS.filter((c) => selectedAddIds.has(c.id)).map((c) => ({
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

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput("")
  }

  const breadcrumb = mode === "create"
    ? "Suítes / Nova Suíte"
    : `Suítes / ${suite?.id ?? "S-0008"} - 12/02/2026 - 12:00 PM`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/suites" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Suítes
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">
            {mode === "create" ? "Nova Suíte" : `${suite?.id ?? "S-0008"}`}
          </span>
        </div>
        <Button>
          <Check className="size-4" />
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Suíte <span className="text-destructive">*</span>
            </label>
            <Input placeholder="SPRINT-001" defaultValue={suite?.suiteName} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Sistema <span className="text-destructive">*</span>
            </label>
            <Select defaultValue={suite?.modulo} disabled={systemList.length === 0}>
              <SelectTrigger><SelectValue placeholder={systemList.length === 0 ? "Nenhum sistema cadastrado" : "Selecionar"} /></SelectTrigger>
              <SelectPopup>
                {systemList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Versão <span className="text-destructive">*</span>
            </label>
            <Input placeholder="1.0.0" defaultValue={suite?.versao} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Módulo <span className="text-destructive">*</span>
            </label>
            <Select defaultValue={suite?.modulo}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectPopup>
                {MODULE_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectPopup>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Tipo <span className="text-destructive">*</span>
            </label>
            <Select defaultValue={suite?.tipo}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="Sprint">Sprint</SelectItem>
                <SelectItem value="Kanban">Kanban</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectPopup>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Observações</label>
            <textarea
              rows={3}
              placeholder="Observações..."
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Tag</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                  {t}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
              />
              <Button variant="outline" size="sm" onClick={addTag}>+</Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-text-primary">
                Cenários: {cenarios.length}
              </h2>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Buscar..."
                  value={cenarioSearch}
                  onChange={(e) => setCenarioSearch(e.target.value)}
                  className="w-48"
                />
                <Button size="sm" onClick={() => setAddCenarioOpen(true)}>
                  <Plus className="size-4" />
                  Adicionar Cenário
                </Button>
              </div>
            </div>

            {cenarios.length === 0 ? (
              <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
                Nenhum cenário adicionado à suíte.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Exe.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Erros</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Dep.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                      <th className="py-3 pl-4 pr-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {cenarios
                      .filter((c) =>
                        !cenarioSearch ||
                        c.id.toLowerCase().includes(cenarioSearch.toLowerCase()) ||
                        c.name.toLowerCase().includes(cenarioSearch.toLowerCase())
                      )
                      .map((c) => (
                        <tr key={c.id} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                          <td className="px-4 py-3">
                            <Link href={`/cenarios/${c.id}`} className="font-medium text-brand-primary hover:underline">{c.id}</Link>
                          </td>
                          <td className="px-4 py-3 max-w-40">
                            <span className="block truncate text-text-primary">{c.name}</span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{c.module}</td>
                          <td className="px-4 py-3 text-text-secondary">{c.execucoes}</td>
                          <td className="px-4 py-3 text-text-secondary">{c.erros}</td>
                          <td className="px-4 py-3 text-text-secondary">{c.deps}</td>
                          <td className="px-4 py-3">
                            <CenarioTipoBadge tipo={c.tipo as CenarioTipo} />
                          </td>
                          <td className="py-3 pl-4 pr-6">
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
                                    <Link href={`/cenarios/${c.id}`} className="w-full">Executar</Link>
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

          {mode === "edit" && (
            <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-text-primary">Histórico de Testes</h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedHistorico.size === 0}
                >
                  Exportar para o Jira
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-neutral-grey-50">
                      <th className="px-4 py-3 text-left">
                        <Checkbox
                          checked={selectedHistorico.size === MOCK_HISTORICO.length}
                          onChange={() => {
                            if (selectedHistorico.size === MOCK_HISTORICO.length) {
                              setSelectedHistorico(new Set())
                            } else {
                              setSelectedHistorico(new Set(MOCK_HISTORICO.map((h) => h.id)))
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Dep.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Execução</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_HISTORICO.map((h) => (
                      <tr key={`${h.id}-${h.data}`} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedHistorico.has(h.id)}
                            onChange={() => {
                              setSelectedHistorico((prev) => {
                                const next = new Set(prev)
                                if (next.has(h.id)) next.delete(h.id)
                                else next.add(h.id)
                                return next
                              })
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/cenarios/${h.id}`} className="font-medium text-brand-primary hover:underline">{h.id}</Link>
                        </td>
                        <td className="px-4 py-3 text-text-primary">{h.cenario}</td>
                        <td className="px-4 py-3 text-text-secondary">{h.module}</td>
                        <td className="px-4 py-3"><CenarioTipoBadge tipo={h.tipo as CenarioTipo} /></td>
                        <td className="px-4 py-3 text-text-secondary">{h.deps}</td>
                        <td className="px-4 py-3 text-text-secondary">{h.data}</td>
                        <td className="px-4 py-3"><ResultadoBadge resultado={h.resultado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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
                    onChange={() => {
                      setSelectedAddIds((prev) => {
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
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setAddCenarioOpen(false)}>Cancelar</Button>
            <Button onClick={addCenarios}>Adicionar</Button>
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
            <Button
              variant="destructive"
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
