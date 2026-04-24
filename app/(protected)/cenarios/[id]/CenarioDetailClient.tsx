"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Circle, Eye, EyeOff, ExternalLink, Check, X, Paperclip, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { CenarioRecord } from "@/lib/actions/cenarios"
import type { SuiteRecord } from "@/lib/actions/suites"
import { registrarResultadoSuite } from "@/lib/actions/suites"
import { CenarioTipoBadge } from "@/components/qagrotis/StatusBadge"
import type { CenarioTipo } from "@/components/qagrotis/StatusBadge"
import { LoadingOverlay } from "@/components/qagrotis/LoadingOverlay"

export type EvFile = { name: string; type: string; dataUrl: string }

export function evStorageKey(cenarioId: string, tipo: "manual" | "auto") {
  return `qagrotis_ev_${cenarioId}_${tipo}`
}

async function fileToEvFile(file: File): Promise<EvFile> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result as string })
    reader.readAsDataURL(file)
  })
}

interface Props {
  cenario: CenarioRecord
  suite?: SuiteRecord
  allCenarios?: CenarioRecord[]
}

/* ── Helpers ── */

/** Exibe BDD preservando quebras de linha (evita “quebrar” texto no meio de palavras) */
function formatBdd(text: string): React.ReactNode {
  if (!text?.trim()) return <span className="text-text-secondary italic">—</span>
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  return (
    <span className="whitespace-pre-wrap break-words">
      {lines.map((line, i) => (
        <span key={i} className="block min-h-[1.25em]">
          {line || "\u00A0"}
        </span>
      ))}
    </span>
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
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertaObs, setAlertaObs] = useState("")
  const [manualEvs, setManualEvs] = useState<EvFile[]>([])
  const [autoEvs, setAutoEvs] = useState<EvFile[]>([])
  const manualInputRef = useRef<HTMLInputElement>(null)
  const autoInputRef = useRef<HTMLInputElement>(null)

  const steps = cenario.steps ?? []
  const depIds = cenario.deps ?? []
  const showTesteManual =
    cenario.tipo === "Manual" || cenario.tipo === "Man./Auto."
  const showAutomacao =
    cenario.tipo === "Automatizado" || cenario.tipo === "Man./Auto."
  const viewOnly = cenario.active === false
  const allowEvidencias = !viewOnly

  // Carrega evidências salvas na sessão ao abrir o cenário (só quando edição permitida)
  useEffect(() => {
    if (viewOnly) return
    try {
      const m = sessionStorage.getItem(evStorageKey(cenario.id, "manual"))
      const a = sessionStorage.getItem(evStorageKey(cenario.id, "auto"))
      if (m) setManualEvs(JSON.parse(m))
      if (a) setAutoEvs(JSON.parse(a))
    } catch { /* ignore */ }
  }, [cenario.id, viewOnly])

  // Persiste evidências na sessão sempre que mudam
  useEffect(() => {
    if (viewOnly) return
    sessionStorage.setItem(evStorageKey(cenario.id, "manual"), JSON.stringify(manualEvs))
  }, [cenario.id, manualEvs, viewOnly])

  useEffect(() => {
    if (viewOnly) return
    sessionStorage.setItem(evStorageKey(cenario.id, "auto"), JSON.stringify(autoEvs))
  }, [cenario.id, autoEvs, viewOnly])

  async function handleManualFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (viewOnly) return
    const files = Array.from(e.target.files ?? [])
    const evFiles = await Promise.all(files.map(fileToEvFile))
    setManualEvs((prev) => [...prev, ...evFiles])
    e.target.value = ""
  }

  async function handleAutoFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (viewOnly) return
    const files = Array.from(e.target.files ?? [])
    const evFiles = await Promise.all(files.map(fileToEvFile))
    setAutoEvs((prev) => [...prev, ...evFiles])
    e.target.value = ""
  }

  async function handleResult(resultado: "Sucesso" | "Erro") {
    if (!suite) return
    setIsRegistering(true)
    try {
      await registrarResultadoSuite(suite.id, cenario.id, resultado)
      toast.success("Teste registrado com sucesso!")
      router.push(`/suites/${suite.id}?tab=cenarios`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar o resultado")
    } finally {
      setIsRegistering(false)
    }
  }

  async function handleRegistrarAlerta() {
    if (!suite) return
    const obs = alertaObs.trim()
    if (!obs) {
      toast.error("Descreva os pontos de atenção.")
      return
    }
    setIsRegistering(true)
    try {
      await registrarResultadoSuite(suite.id, cenario.id, "Alerta", { alertaObs: obs })
      toast.success("Alerta registrado com sucesso!")
      setAlertModalOpen(false)
      setAlertaObs("")
      router.push(`/suites/${suite.id}?tab=historico`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar o alerta")
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
      <LoadingOverlay visible={isRegistering} label="Registrando resultado..." />

      <Dialog
        open={alertModalOpen}
        onOpenChange={(open) => {
          setAlertModalOpen(open)
          if (!open) setAlertaObs("")
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar alerta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Descreva os pontos de atenção desta execução. A informação fica guardada no histórico da suíte e pode ser enviada ao Jira nas exportações.
          </p>
          <Textarea
            value={alertaObs}
            onChange={(e) => setAlertaObs(e.target.value)}
            placeholder="Pontos de atenção…"
            className="min-h-28"
            disabled={isRegistering}
          />
          <DialogFooter showCloseButton={false}>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setAlertModalOpen(false); setAlertaObs("") }}
              disabled={isRegistering}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isRegistering}
              onClick={() => { void handleRegistrarAlerta() }}
              className="bg-yellow-500 text-yellow-950 hover:bg-yellow-400 border-yellow-600/30"
            >
              Confirmar alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          {viewOnly && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-grey-300 bg-neutral-grey-100 px-3 py-1 text-xs font-medium text-text-secondary">
              Somente visualização — cenário inativo
            </span>
          )}
          {suite && !viewOnly && (
            <>
              <Button
                onClick={() => handleResult("Sucesso")}
                disabled={isRegistering}
              >
                <Check className="size-4" />
                Sucesso
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isRegistering}
                onClick={() => setAlertModalOpen(true)}
                className="border-yellow-500/60 bg-yellow-50 text-yellow-950 hover:bg-yellow-100 dark:border-yellow-500/45 dark:bg-yellow-950/50 dark:text-yellow-100 dark:hover:bg-yellow-900/40"
              >
                <TriangleAlert className="size-4" />
                Alerta
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

      {/* ── Bloco 2: Teste Manual (só Manual ou Man./Auto.) ── */}
      {showTesteManual && <BlockCard title="Teste Manual">
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

        {/* ── Evidências Teste Manual ── */}
        <div className="border-t border-border-default pt-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-xs font-semibold text-text-secondary">
              Evidências{manualEvs.length > 0 ? ` (${manualEvs.length})` : ""}
            </span>
            {allowEvidencias ? (
              <>
                <Button variant="outline" onClick={() => manualInputRef.current?.click()}>
                  <Paperclip className="size-4" />
                  Anexar Evidências
                </Button>
                <input
                  ref={manualInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleManualFiles}
                />
              </>
            ) : (
              <span className="text-xs text-text-secondary">Somente visualização</span>
            )}
          </div>
          {manualEvs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {manualEvs.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-neutral-grey-50 px-2.5 py-1 text-xs text-text-primary"
                >
                  <Paperclip className="size-3 shrink-0 text-text-secondary" />
                  <span className="max-w-40 truncate">{f.name}</span>
                  {allowEvidencias && (
                    <button
                      type="button"
                      onClick={() => setManualEvs((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-text-secondary hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary italic">Nenhuma evidência anexada.</p>
          )}
        </div>
      </BlockCard>}

      {/* ── Bloco 3: Automação (só Automatizado ou Man./Auto.) ── */}
      {showAutomacao && <BlockCard title="Automação">
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
                  <table className="qagrotis-table-row-hover w-full text-sm">
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

            {/* ── Evidências Automação ── */}
            <div className="border-t border-border-default pt-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-xs font-semibold text-text-secondary">
                  Evidências{autoEvs.length > 0 ? ` (${autoEvs.length})` : ""}
                </span>
                {allowEvidencias ? (
                  <>
                    <Button variant="outline" onClick={() => autoInputRef.current?.click()}>
                      <Paperclip className="size-4" />
                      Anexar Evidências
                    </Button>
                    <input
                      ref={autoInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleAutoFiles}
                    />
                  </>
                ) : (
                  <span className="text-xs text-text-secondary">Somente visualização</span>
                )}
              </div>
              {autoEvs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {autoEvs.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-neutral-grey-50 px-2.5 py-1 text-xs text-text-primary"
                    >
                      <Paperclip className="size-3 shrink-0 text-text-secondary" />
                      <span className="max-w-40 truncate">{f.name}</span>
                      {allowEvidencias && (
                        <button
                          type="button"
                          onClick={() => setAutoEvs((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-text-secondary hover:text-destructive transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary italic">Nenhuma evidência anexada.</p>
              )}
            </div>

          </div>
      </BlockCard>}

      {/* ── Bloco 4: Dependências ── */}
      {depIds.length > 0 && <BlockCard title={`Dependências (${depIds.length})`}>
          <div className="min-w-0 overflow-x-auto rounded-lg border border-border-default">
            <table className="qagrotis-table-row-hover w-full min-w-[48rem] table-fixed text-sm">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-24" />
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
                    className="border-b border-border-default last:border-0 transition-colors"
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
                    <td className="max-w-0 truncate px-4 py-3 text-text-primary" title={"scenarioName" in dep ? dep.scenarioName : undefined}>{"scenarioName" in dep ? dep.scenarioName : "—"}</td>
                    <td className="max-w-0 truncate px-4 py-3 text-text-secondary" title={"system" in dep ? dep.system : undefined}>{"system" in dep ? dep.system : "—"}</td>
                    <td className="max-w-0 truncate px-4 py-3 text-text-secondary" title={"module" in dep ? dep.module : undefined}>{"module" in dep ? dep.module : "—"}</td>
                    <td className="max-w-0 truncate px-4 py-3 text-text-secondary" title={"client" in dep ? dep.client : undefined}>{"client" in dep ? dep.client : "—"}</td>
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
