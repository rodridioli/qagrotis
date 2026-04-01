"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Circle, Eye, EyeOff, ExternalLink, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { SuiteRecord } from "@/lib/actions/suites"
import { registrarResultadoSuite } from "@/lib/actions/suites"
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"

interface Props {
  cenario: CenarioRecord
  suite?: SuiteRecord
  allCenarios?: CenarioRecord[]
}

/* ── Helpers ── */

/** Quebra o BDD em linhas, destacando DADO/QUANDO/ENTÃO */
function formatBdd(text: string): React.ReactNode {
  if (!text) return <span className="text-text-secondary italic">—</span>
  // Quebra antes de cada palavra-chave (case-insensitive)
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/(\n)?(DADO|QUANDO|ENTÃO|ENTAO|AND|E\s)/gi, (m) => `\n${m.trim()}`)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

  return (
    <>
      {normalized.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </>
  )
}

/* ── Sub-componentes ── */

function DisabledInput({ value }: { value?: string | null }) {
  return (
    <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 text-sm text-text-primary cursor-not-allowed select-none min-h-9.5 flex items-center">
      {value ? <span>{value}</span> : <span className="text-text-secondary italic">—</span>}
    </div>
  )
}

function DisabledTextarea({ value }: { value?: string | null }) {
  return (
    <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 text-sm text-text-primary cursor-not-allowed select-none whitespace-pre-wrap min-h-15">
      {value ? <span>{value}</span> : <span className="text-text-secondary italic">—</span>}
    </div>
  )
}

function PasswordField({ label, value }: { label: string; value?: string | null }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="relative">
        <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 pr-9 text-sm text-text-primary cursor-not-allowed select-none min-h-9.5 flex items-center">
          {value ? (
            show ? (
              <span>{value}</span>
            ) : (
              <span className="tracking-widest text-text-secondary">••••••••</span>
            )
          ) : (
            <span className="text-text-secondary italic">—</span>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
            title={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, className }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </div>
  )
}

/* ── BlockCard com expand/collapse ── */
function BlockCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-grey-50 transition-colors"
      >
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {open ? (
          <ChevronUp className="size-4 text-text-secondary shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-text-secondary shrink-0" />
        )}
      </button>

      {open && (
        <>
          <div className="border-t border-border-default" />
          <div className="p-5 space-y-4">{children}</div>
        </>
      )}
    </div>
  )
}

/* ── Componente principal ── */

export default function CenarioDetailClient({ cenario, suite, allCenarios = [] }: Props) {
  const router = useRouter()
  const [isRegistering, setIsRegistering] = useState(false)

  const steps = cenario.steps ?? []
  const depIds = cenario.deps ?? []
  const isAutomatizado = cenario.tipo === "Automatizado" || cenario.tipo === "Man./Auto."

  async function handleResult(resultado: "Sucesso" | "Erro") {
    if (!suite) return
    setIsRegistering(true)
    try {
      await registrarResultadoSuite(suite.id, cenario.id, resultado)
      toast.success("Teste registrado com sucesso!")
      router.push(`/suites/${suite.id}?tab=historico`)
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar o resultado")
    } finally {
      setIsRegistering(false)
    }
  }

  // Enriquece as dependências com dados completos
  const depsData = depIds.map((depId) => {
    const found = allCenarios.find((c) => c.id === depId)
    return found ?? { id: depId, scenarioName: "—", module: "—", client: "—", tipo: "—" }
  })

  return (
    <div className="space-y-4">

      {/* ── Header / Breadcrumb ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={suite ? "/suites" : "/cenarios"}
            title={suite ? "Voltar para Suítes" : "Voltar para Cenários"}
            className="flex items-center gap-1 text-text-secondary hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
            {suite ? "Suítes" : "Cenários"}
          </Link>
          {suite && (
            <>
              <span className="text-text-secondary">/</span>
              <Link
                href={`/suites/${suite.id}`}
                className="text-text-secondary hover:text-brand-primary"
              >
                {suite.id}
              </Link>
            </>
          )}
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">{cenario.id}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {suite && (
            <>
              <Button
                onClick={() => handleResult("Sucesso")}
                disabled={isRegistering}
              >
                <Check className="size-4" />
                Sucesso
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleResult("Erro")}
                disabled={isRegistering}
              >
                <X className="size-4" />
                Erro
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Bloco 1: Dados do Cenário ── */}
      <BlockCard title="Dados do Cenário">
        {/* Linha 1: Nome do cenário */}
        <Field label="Cenário">
          <DisabledInput value={cenario.scenarioName} />
        </Field>

        {/* Linha 2: Sistema | Módulo | Risco */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Sistema">
            <DisabledInput value={cenario.system} />
          </Field>
          <Field label="Módulo">
            <DisabledInput value={cenario.module} />
          </Field>
          <Field label="Risco">
            <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 min-h-9.5 flex items-center cursor-not-allowed">
              {cenario.risco ? (
                <span className="flex items-center gap-1.5 text-sm font-medium"
                  style={{
                    color: cenario.risco === "Alto" ? "#ef4444" : cenario.risco === "Médio" ? "#f59e0b" : "#3b82f6"
                  }}
                >
                  {cenario.risco === "Alto" && <ArrowUp className="size-3.5 shrink-0" />}
                  {cenario.risco === "Médio" && <Circle className="size-3.5 shrink-0 fill-amber-400" />}
                  {cenario.risco === "Baixo" && <ArrowDown className="size-3.5 shrink-0" />}
                  {cenario.risco}
                </span>
              ) : (
                <span className="text-text-secondary italic text-sm">—</span>
              )}
            </div>
          </Field>
        </div>
      </BlockCard>

      {/* ── Bloco 2: Teste Manual ── */}
      <BlockCard title="Teste Manual">
        <Field label="Descrição">
          <DisabledTextarea value={cenario.descricao} />
        </Field>
        <Field label="Regra de Negócio">
          <DisabledTextarea value={cenario.regraDeNegocio} />
        </Field>
        <Field label="Pré-condições">
          <DisabledTextarea value={cenario.preCondicoes} />
        </Field>
        <Field label="BDD (Gherkin)">
          <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 text-sm text-text-primary cursor-not-allowed select-none min-h-20 leading-6 whitespace-pre-wrap">
            {formatBdd(cenario.bdd ?? "")}
          </div>
        </Field>
        <Field label="Resultado Esperado">
          <DisabledTextarea value={cenario.resultadoEsperado} />
        </Field>
      </BlockCard>

      {/* ── Bloco 3: Automação ── */}
      {isAutomatizado && <BlockCard title="Automação">
          <div className="space-y-5">

            {/* Credenciais — mesma linha */}
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Credenciais</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Usuário de Teste">
                  <DisabledInput value={cenario.usuarioTeste} />
                </Field>
                <PasswordField label="Senha de Teste" value={cenario.senhaTeste} />
                <PasswordField label="Senha Falsa" value={cenario.senhaFalsa} />
              </div>
            </div>

            {/* Passo a passo — tabela */}
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">
                Passo a passo ({steps.length})
              </p>
              {steps.length === 0 ? (
                <div className="rounded-lg border border-border-default bg-neutral-grey-50 px-6 py-8 text-center text-sm text-text-secondary">
                  Nenhum passo cadastrado.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border-default">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-default bg-neutral-grey-50">
                        <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-text-secondary">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Ação</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Resultado Esperado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {steps.map((step, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-border-default last:border-0 bg-neutral-grey-50/30"
                        >
                          <td className="px-4 py-3 text-xs font-medium text-text-secondary">{idx + 1}</td>
                          <td className="px-4 py-3 text-text-primary">{step.acao}</td>
                          <td className="px-4 py-3 text-text-primary">{step.resultado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* URL do Script + botão Executar */}
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">URL do Script</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 text-sm cursor-not-allowed select-none min-h-9.5 flex items-center">
                  {cenario.urlScript ? (
                    <span className="text-brand-primary break-all">{cenario.urlScript}</span>
                  ) : (
                    <span className="text-text-secondary italic">—</span>
                  )}
                </div>
                <Button
                  disabled
                  title="Funcionalidade disponível em breve"
                  className="shrink-0"
                >
                  <ExternalLink className="size-4" />
                  Executar
                </Button>
              </div>
            </div>

          </div>
      </BlockCard>}

      {/* ── Bloco 4: Dependências ── */}
      {depIds.length > 0 && <BlockCard title={`Dependências (${depIds.length})`}>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-28" />
                <col />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cenário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Sistema</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Módulo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {depsData.map((dep) => (
                  <tr
                    key={dep.id}
                    className="border-b border-border-default last:border-0 transition-colors hover:bg-neutral-grey-50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/cenarios/${dep.id}/editar`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-primary hover:underline"
                      >
                        {dep.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-primary truncate">{"scenarioName" in dep ? dep.scenarioName : "—"}</td>
                    <td className="px-4 py-3 text-text-secondary truncate">{"system" in dep ? dep.system : "—"}</td>
                    <td className="px-4 py-3 text-text-secondary truncate">{"module" in dep ? dep.module : "—"}</td>
                    <td className="px-4 py-3 text-text-secondary truncate">{"client" in dep ? dep.client : "—"}</td>
                    <td className="px-4 py-3">
                      {"tipo" in dep && dep.tipo && dep.tipo !== "—" ? (
                        <CenarioTipoBadge tipo={dep.tipo as CenarioTipo} />
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </BlockCard>}

    </div>
  )
}
