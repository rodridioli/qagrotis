"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  MODULE_LIST,
  SYSTEM_LIST,
  CLIENT_LIST,
  PRIORIDADE_LIST,
  MOCK_CENARIOS,
} from "@/lib/qagrotis-constants"

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

export default function NovoCenarioPage() {
  const [manual, setManual] = useState(false)
  const [automatizado, setAutomatizado] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [deps, setDeps] = useState<Dep[]>([])
  const [addStepOpen, setAddStepOpen] = useState(false)
  const [addDepOpen, setAddDepOpen] = useState(false)
  const [addClienteOpen, setAddClienteOpen] = useState(false)
  const [stepAcao, setStepAcao] = useState("")
  const [stepResultado, setStepResultado] = useState("")
  const [depSearch, setDepSearch] = useState("")
  const [selectedDepIds, setSelectedDepIds] = useState<Set<string>>(new Set())
  const [newClienteName, setNewClienteName] = useState("")
  const [newClienteCpf, setNewClienteCpf] = useState("")

  const filteredDepCenarios = MOCK_CENARIOS.filter((c) =>
    !depSearch ||
    c.id.toLowerCase().includes(depSearch.toLowerCase()) ||
    c.scenarioName.toLowerCase().includes(depSearch.toLowerCase())
  ).slice(0, 10)

  function addStep() {
    if (!stepAcao || !stepResultado) return
    setSteps((prev) => [
      ...prev,
      { id: Date.now(), acao: stepAcao, resultado: stepResultado },
    ])
    setStepAcao("")
    setStepResultado("")
    setAddStepOpen(false)
  }

  function addDeps() {
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
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/cenarios" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Novo Cenário</span>
        </div>
        <Button>Salvar</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl bg-surface-card p-5 shadow-card space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Cenário <span className="text-destructive">*</span>
            </label>
            <Input placeholder="Nome do cenário" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Sistema <span className="text-destructive">*</span>
              </label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  {SYSTEM_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Módulo <span className="text-destructive">*</span>
              </label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  {MODULE_LIST.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Cliente</label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  {CLIENT_LIST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__add__" onClick={() => setAddClienteOpen(true)}>
                    + Adicionar Cliente
                  </SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Prioridade <span className="text-destructive">*</span>
              </label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectPopup>
                  {PRIORIDADE_LIST.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Regra de Negócio <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Descreva a regra de negócio..."
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Objetivo <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Objetivo do teste..."
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Pré-condições <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="Pré-condições necessárias..."
              className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={manual}
                onClick={() => setManual(!manual)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  manual ? "bg-brand-primary" : "bg-neutral-grey-300"
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    manual ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-text-primary">Manual</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={automatizado}
                onClick={() => setAutomatizado(!automatizado)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  automatizado ? "bg-brand-primary" : "bg-neutral-grey-300"
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    automatizado ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-sm text-text-primary">Automatizado</span>
            </label>
          </div>

          {automatizado && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Script</label>
              <Input placeholder="https://github.com/..." />
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
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
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
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
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
                onChange={(e) => setNewClienteCpf(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setAddClienteOpen(false)}>Cancelar</Button>
            <Button onClick={() => setAddClienteOpen(false)}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
