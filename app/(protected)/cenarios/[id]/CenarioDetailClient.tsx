"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { SuiteRecord } from "@/lib/actions/suites"
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"

interface Props {
  cenario: CenarioRecord
  suite?: SuiteRecord
}

type Tab = "cenario" | "manual" | "automatizado" | "dependencias"

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <p className="text-sm text-text-primary whitespace-pre-wrap">{value}</p>
    </div>
  )
}

export default function CenarioDetailClient({ cenario, suite }: Props) {
  const steps = cenario.steps ?? []
  const deps = cenario.deps ?? []
  const isAutomatizado = cenario.tipo === "Automatizado" || cenario.tipo === "Man./Auto."

  const [activeTab, setActiveTab] = useState<Tab>("cenario")
  const [stepStatuses, setStepStatuses] = useState<Record<number, string>>(
    Object.fromEntries(steps.map((_, i) => [i, "Pendente"]))
  )

  const TABS: { id: Tab; label: string; badge?: number | null; disabled?: boolean }[] = [
    { id: "cenario",       label: "Cenário" },
    { id: "manual",        label: "Teste Manual",  badge: steps.length > 0 ? steps.length : null },
    { id: "automatizado",  label: "Automatizado",  disabled: !isAutomatizado },
    { id: "dependencias",  label: "Dependências",  badge: deps.length > 0 ? deps.length : null },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/cenarios"
            title="Voltar para Cenários"
            className="flex items-center gap-1 text-text-secondary hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          {suite && (
            <>
              <span className="text-text-secondary">/</span>
              <Link
                href={`/suites/${suite.id}`}
                className="text-text-secondary hover:text-brand-primary"
              >
                {suite.suiteName}
              </Link>
            </>
          )}
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">{cenario.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <Check className="size-4" />
            Salvar
          </Button>
          <Button className="bg-primary-700 hover:bg-primary-800 text-white!">Sucesso</Button>
          <Button variant="destructive">Erro</Button>
        </div>
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
              title={disabled ? "Habilite o tipo Automatizado no cadastro do cenário para acessar esta aba" : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-all ${
                disabled
                  ? "cursor-not-allowed border-transparent text-text-secondary/40 opacity-50"
                  : activeTab === id
                  ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
              }`}
            >
              {label}
              {badge != null && (
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

        {/* ── Cenário ── */}
        <div className={`p-5${activeTab !== "cenario" ? " hidden" : ""}`}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Coluna: identificação */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Identificação</h3>
              <div className="space-y-3">
                <InfoRow label="Cenário" value={cenario.scenarioName} />
                <InfoRow label="Sistema" value={cenario.system} />
                <InfoRow label="Módulo" value={cenario.module} />
                <InfoRow label="Cliente" value={cenario.client} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">Tipo</span>
                  <CenarioTipoBadge tipo={cenario.tipo as CenarioTipo} />
                </div>
                {cenario.risco && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-secondary">Risco</span>
                    <span className={`text-sm font-medium ${
                      cenario.risco === "Alto" ? "text-red-600" :
                      cenario.risco === "Médio" ? "text-amber-600" : "text-blue-600"
                    }`}>{cenario.risco}</span>
                  </div>
                )}
                <InfoRow label="Caminho da Tela" value={cenario.caminhoTela} />
              </div>
            </div>

            {/* Coluna: descrição */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Descrição</h3>
              <div className="space-y-3">
                <InfoRow label="Descrição" value={cenario.descricao} />
                <InfoRow label="Regra de Negócio" value={cenario.regraDeNegocio} />
                <InfoRow label="Pré-condições" value={cenario.preCondicoes} />
                <InfoRow label="Resultado Esperado" value={cenario.resultadoEsperado} />
              </div>
            </div>

            {/* Coluna: ações */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Ações</h3>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/cenarios/${cenario.id}/editar`}
                  className="inline-flex h-9 items-center justify-center rounded-custom border border-border-default bg-background px-3 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-50"
                >
                  Editar Cenário
                </Link>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
                  <span className="text-text-secondary">Execuções</span>
                  <span className="font-semibold text-text-primary">{cenario.execucoes}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
                  <span className="text-text-secondary">Erros</span>
                  <span className="font-semibold text-red-600">{cenario.erros}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border-default px-3 py-2">
                  <span className="text-text-secondary">Suítes</span>
                  <span className="font-semibold text-text-primary">{cenario.suites}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Teste Manual ── */}
        <div className={`p-5 space-y-4${activeTab !== "manual" ? " hidden" : ""}`}>
          {cenario.bdd && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">BDD (Gherkin)</h3>
              <pre className="rounded-lg border border-border-default bg-neutral-grey-50 p-4 text-sm text-text-primary whitespace-pre-wrap font-mono">{cenario.bdd}</pre>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Passos ({steps.length})
            </h3>
            {steps.length === 0 ? (
              <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
                Nenhum passo cadastrado.
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-border-default p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Passo {idx + 1}</span>
                      <Select
                        value={stepStatuses[idx]}
                        onValueChange={(v: string | null) =>
                          setStepStatuses((prev) => ({ ...prev, [idx]: v ?? "Pendente" }))
                        }
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                          <SelectItem value="Pendente">Pendente</SelectItem>
                          <SelectItem value="Sucesso">Sucesso</SelectItem>
                          <SelectItem value="Erro">Erro</SelectItem>
                        </SelectPopup>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary mb-0.5">Ação</p>
                      <p className="text-sm text-text-primary">{step.acao}</p>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary mb-0.5">Resultado esperado</p>
                      <p className="text-sm text-text-primary">{step.resultado}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Automatizado ── */}
        <div className={`p-5 space-y-4${activeTab !== "automatizado" ? " hidden" : ""}`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cenario.urlScript ? (
              <div className="sm:col-span-2 space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">URL do Script</span>
                <p className="text-sm text-brand-primary break-all">{cenario.urlScript}</p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Usuário de Teste</span>
              <p className="text-sm text-text-primary">{cenario.usuarioTeste || <span className="text-text-secondary italic">Não informado</span>}</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Senha de Teste</span>
              <p className="text-sm text-text-primary">
                {cenario.senhaTeste ? "••••••••" : <span className="text-text-secondary italic">Não informada</span>}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Senha Falsa</span>
              <p className="text-sm text-text-primary">
                {cenario.senhaFalsa ? "••••••••" : <span className="text-text-secondary italic">Não informada</span>}
              </p>
            </div>
          </div>

          {!cenario.urlScript && !cenario.usuarioTeste && (
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhum dado de automação cadastrado.{" "}
              <Link href={`/cenarios/${cenario.id}/editar`} className="text-brand-primary hover:underline">
                Editar cenário
              </Link>{" "}
              para adicionar.
            </div>
          )}
        </div>

        {/* ── Dependências ── */}
        <div className={`p-5 space-y-3${activeTab !== "dependencias" ? " hidden" : ""}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Dependências ({deps.length})
          </h3>
          {deps.length === 0 ? (
            <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-10 text-center text-sm text-text-secondary">
              Nenhuma dependência vinculada a este cenário.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-neutral-grey-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deps.map((depId) => (
                    <tr key={depId} className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/cenarios/${depId}`}
                          className="font-medium text-brand-primary hover:underline"
                        >
                          {depId}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/cenarios/${depId}`}
                          className="text-xs text-text-secondary hover:text-brand-primary"
                        >
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
