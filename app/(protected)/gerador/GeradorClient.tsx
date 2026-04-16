"use client"

import { useState, useRef, useMemo, useEffect, useTransition, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useRouter } from "next/navigation"
import {
  Sparkles, Copy, RotateCcw,
  Pencil, Check, Upload, X, ArrowRightLeft, AlertCircle, CloudUpload, Trash2, ExternalLink,
  FileText, ListChecks, Plus, Eye, EyeOff, ShieldCheck, Loader2, Link2, MoreVertical
} from "lucide-react"
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
  DialogClose,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { criarCenario, atualizarCenario, type CenarioRecord } from "@/lib/actions/cenarios"
import { parseMarkdownCenarios, buildImportItems, type ParsedCenario, type ImportItem, COMPARE_FIELDS } from "@/lib/parse-cenarios"
import { criarIntegracao, type IntegracaoRecord } from "@/lib/actions/integracoes"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"


// ── Component ────────────────────────────────────────────────────────────────

// SectionState removed as blocks are no longer collapsible


interface Props {
  initialCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
  integracoes: IntegracaoRecord[]
}

export function GeradorClient({ initialCenarios, allModulos, integracoes }: Props) {
  const router = useRouter()
  const { sistemaSelecionado } = useSistemaSelecionado()

  const [contexto, setContexto] = useState("")
  const [jiraInput, setJiraInput] = useState("")
  const [jiraConfigured, setJiraConfigured] = useState(false)

  // Check if Jira is configured in localStorage
  useEffect(() => {
    const url = localStorage.getItem("jira_url")
    const email = localStorage.getItem("jira_email")
    const token = localStorage.getItem("jira_token")
    setJiraConfigured(!!(url && email && token))
  }, [])
  const activeIntegracoes = useMemo(() => integracoes.filter(i => i.active !== false), [integracoes])
  const [aiProvider, setAiProvider] = useState<string>(() => {
    // Safe: activeIntegracoes is derived from server props, stable on first render
    return activeIntegracoes[0]?.id ?? ""
  })

  // On mount: restore saved preference if still valid, else keep first available
  useEffect(() => {
    const saved = localStorage.getItem("gerador-ai-provider")
    if (saved && activeIntegracoes.some((i) => i.id === saved)) {
      setAiProvider(saved)
    } else if (activeIntegracoes.length > 0) {
      setAiProvider(activeIntegracoes[0].id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (aiProvider) localStorage.setItem("gerador-ai-provider", aiProvider)
  }, [aiProvider])

  const [output, setOutput] = useState("")
  const [apiError, setApiError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"contexto" | "cenarios">("contexto")

  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [anexoPreviews, setAnexoPreviews] = useState<{ name: string; dataUrl: string }[]>([])

  // Import state
  const [importSetupOpen, setImportSetupOpen] = useState(false)
  const [importModule, setImportModule] = useState("")
  const [importItems, setImportItems] = useState<ImportItem[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [compareItem, setCompareItem] = useState<ImportItem | null>(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 })
  const [importProgressOpen, setImportProgressOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importedIds, setImportedIds] = useState<string[]>([])
  const [suitePromptOpen, setSuitePromptOpen] = useState(false)

  // ── Inline integration modal state ─────────────────────────────────────────
  type KeyStatus = "idle" | "validating" | "valid" | "invalid" | "uncertain"
  const [intModalOpen, setIntModalOpen] = useState(false)
  const [intProvider, setIntProvider] = useState<"google" | "openai" | "anthropic" | "groq" | "openrouter">("openrouter")
  const [intModel, setIntModel] = useState("google/gemini-2.0-flash-exp:free")
  const [intApiKey, setIntApiKey] = useState("")
  const [intShowKey, setIntShowKey] = useState(false)
  const [intKeyStatus, setIntKeyStatus] = useState<KeyStatus>("idle")
  const [isIntModalPending, startIntModalTransition] = useTransition()

  function openIntModal() {
    setIntProvider("openrouter")
    setIntModel("google/gemini-2.0-flash-exp:free")
    setIntApiKey("")
    setIntShowKey(false)
    setIntKeyStatus("idle")
    setIntModalOpen(true)
  }

  const handleIntProviderChange = (p: string | null) => {
    if (!p) return
    const prov = p as typeof intProvider
    setIntProvider(prov)
    if (prov === "openrouter") setIntModel("google/gemini-2.0-flash-exp:free")
    else if (prov === "google") setIntModel("gemini-2.0-flash-exp")
    else if (prov === "groq") setIntModel("llama-3.1-70b-versatile")
    else if (prov === "openai") setIntModel("gpt-4o-mini")
    else if (prov === "anthropic") setIntModel("claude-opus-4-6")
    setIntKeyStatus("idle")
  }

  const handleIntValidateKey = useCallback(async () => {
    if (!intApiKey.trim()) { toast.error("Digite a API Key antes de verificar."); return }
    setIntKeyStatus("validating")
    try {
      const res = await fetch("/api/integracoes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: intApiKey.trim(), provider: intProvider }),
      })
      if (res.ok) setIntKeyStatus("valid")
      else if (res.status === 401) setIntKeyStatus("invalid")
      else setIntKeyStatus("uncertain")
    } catch {
      setIntKeyStatus("uncertain")
    }
  }, [intApiKey, intProvider])

  function handleSalvarIntegracao() {
    if (!intApiKey.trim()) { toast.error("A API Key é obrigatória."); return }
    if (intKeyStatus === "validating") { toast.error("Aguarde a validação da API Key."); return }
    startIntModalTransition(async () => {
      try {
        await criarIntegracao({
          provider: intProvider,
          model: intModel.trim(),
          apiKey: intApiKey.trim(),
        })
        toast.success("Integração criada com sucesso.")
        setIntModalOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar. Tente novamente.")
      }
    })
  }

  const intStatusIcon: Record<KeyStatus, React.ReactNode> = {
    idle:       null,
    validating: <Loader2 className="size-4 animate-spin text-text-secondary" />,
    valid:      <Check className="size-4 text-green-600" />,
    invalid:    <AlertCircle className="size-4 text-destructive" />,
    uncertain:  <AlertCircle className="size-4 text-amber-500" />,
  }

  const systemModuleNames = useMemo(
    () => allModulos.filter((m) => m.active && m.sistemaName === sistemaSelecionado).map((m) => m.name),
    [allModulos, sistemaSelecionado]
  )

  const cenarioCount = useMemo(
    () => (output ? (output.match(/^(\*\*Cenário:\*\*|Cenário:)/gim) ?? []).length : 0),
    [output]
  )

  async function generate() {
    const hasInput = contexto.trim() || jiraInput.trim() || anexoPreviews.length > 0
    if (!aiProvider) {
      setActiveTab("contexto")
      toast.error("Selecione um Modelo de IA antes de gerar.")
      return
    }
    if (!hasInput) {
      setActiveTab("contexto")
      toast.error("Preencha ao menos um campo: URL do Jira, Contexto ou Anexos.")
      return
    }

    // Fetch Jira issue content if URL/key provided
    let jiraContext = contexto.trim()
    const jiraAttachments: { list: { name: string; dataUrl: string }[] } = { list: [] }
    if (jiraInput.trim()) {
      try {
        const jiraUrl = localStorage.getItem("jira_url") ?? ""
        const jiraEmail = localStorage.getItem("jira_email") ?? ""
        const jiraToken = localStorage.getItem("jira_token") ?? ""
        // Extract issue key from full URL or use as-is
        const issueKey = jiraInput.trim().includes("/")
          ? jiraInput.trim().split("/").pop() ?? jiraInput.trim()
          : jiraInput.trim()
        const params = new URLSearchParams({ jiraUrl, issueKey, email: jiraEmail, apiToken: jiraToken })
        const jiraRes = await fetch(`/api/jira?${params}`)
        if (jiraRes.ok) {
          const jiraData = await jiraRes.json() as {
            summary?: string
            descText?: string
            attachments?: { name: string; mimeType: string; dataUrl: string }[]
          }
          const jiraContent = [
            jiraData.summary ? `Issue: ${jiraData.summary}` : "",
            jiraData.descText ? `Descrição:\n${jiraData.descText}` : "",
          ].filter(Boolean).join("\n\n")
          jiraContext = [jiraContent, jiraContext].filter(Boolean).join("\n\n---\n\n")
          // Merge Jira attachments with existing anexos
          if (jiraData.attachments && jiraData.attachments.length > 0) {
            const jiraAnexos = jiraData.attachments.map(a => ({ name: a.name, dataUrl: a.dataUrl }))
            // Prepend Jira attachments so they get analyzed first
            const merged = [...jiraAnexos, ...anexoPreviews]
            // Temporarily override for this generate call (we'll pass merged directly)
            Object.assign(jiraAttachments, { list: merged })
          }
        }
      } catch { /* continue without Jira data */ }
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setOutput("")
    setApiError(null)
    setIsEditing(false)
    setLoading(true)
    setActiveTab("cenarios")

    try {
      const res = await fetch("/api/gerador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jira: jiraContext || undefined,
          imagens: jiraAttachments.list.length > 0 ? jiraAttachments.list : (anexoPreviews.length > 0 ? anexoPreviews : undefined),
          integrationId: aiProvider,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const msg = await res.text()
        setApiError(msg || "Erro ao gerar casos de teste.")
        toast.error("Falha ao gerar. Veja o detalhe no painel de saída.")
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        full += chunk
        setOutput(full)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Falha na conexão com o servidor.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Convert plain output to rich Markdown for Jira/display
  function formatOutputAsMarkdown(raw: string): string {
    return raw
      // Add bold + newlines before field labels
      .replace(
        /^(Cenário:|Descrição:|Regra de negócio:|Pré-condições:|BDD \(Gherkin\):|Resultado esperado:)/gim,
        (_, label) => `\n\n**${label}**`
      )
      // Ensure --- separators have blank lines around them
      .replace(/\n?---\n?/g, "\n\n---\n\n")
      .trim()
  }

  function handleCopyMarkdown() {
    const markdown = formatOutputAsMarkdown(output)
    navigator.clipboard.writeText(markdown)
    toast.success("Markdown copiado! Cole diretamente no Jira.")
  }

  function handleReset() {
    abortRef.current?.abort()
    setContexto("")
    setAnexoPreviews([])
    setOutput("")
    setApiError(null)
    setIsEditing(false)
    setLoading(false)
    setActiveTab("contexto")
  }

  // ── Import flow ──────────────────────────────────────────────────────────

  function openImportSetup() {
    if (!output.trim()) {
      toast.error("Gere os casos de teste primeiro.")
      return
    }
    setImportModule("")
    setImportSetupOpen(true)
  }

  function handleImportSetupConfirm() {
    if (!importModule) return
    const parsed = parseMarkdownCenarios(output)
    if (parsed.length === 0) {
      toast.error("Nenhum cenário reconhecido no texto gerado.")
      setImportSetupOpen(false)
      return
    }

    const items = buildImportItems(parsed, importModule, initialCenarios, systemModuleNames)
    setImportItems(items)
    setImportSetupOpen(false)
    setImportModalOpen(true)
  }

  async function handleImportConfirm() {
    const toImport = importItems.filter((item) => item.include && !item.error)
    if (toImport.length === 0) { toast.warning("Nenhum cenário selecionado para importar."); return }

    setImportModalOpen(false)
    setImportProgress({ current: 0, total: toImport.length })
    setImportProgressOpen(true)
    setIsImporting(true)

    let success = 0
    const createdIds: string[] = []
    try {
      for (let i = 0; i < toImport.length; i++) {
        const item = toImport[i]
        const payload = {
          scenarioName:      item.parsed.scenarioName ?? "",
          system:            sistemaSelecionado || "",
          module:            item.parsed.module ?? "",
          client:            item.parsed.client ?? "",
          risco:             item.parsed.risco ?? "",
          tipo:              item.parsed.tipo ?? "Manual",
          descricao:         item.parsed.descricao || item.parsed.bdd || "-",
          caminhoTela:       item.parsed.caminhoTela ?? "",
          regraDeNegocio:    item.parsed.regraDeNegocio || "Não informado.",
          preCondicoes:      item.parsed.preCondicoes ?? "",
          bdd:               item.parsed.bdd ?? "",
          resultadoEsperado: item.parsed.resultadoEsperado || "-",
          urlAmbiente: "",
          objetivo: "",
          urlScript: "",
          usuarioTeste: "",
          senhaTeste: "",
          senhaFalsa: "",
          steps: [],
          deps: [],
        }
        try {
          if (item.replace && item.existing) {
            await atualizarCenario(item.existing.id, payload)
            createdIds.push(item.existing.id)
          } else {
            const created = await criarCenario(payload)
            createdIds.push(created.id)
          }
          success++
        } catch (err) {
          toast.error(`Erro ao importar "${item.parsed.scenarioName}": ${err instanceof Error ? err.message : "Erro"}`)
        }
        setImportProgress({ current: i + 1, total: toImport.length })
      }
    } finally {
      setIsImporting(false)
      setImportProgressOpen(false)
    }

    if (success > 0) {
      router.refresh()
      toast.success(success === 1 ? "1 cenário importado com sucesso." : `${success} cenários importados com sucesso.`)
      // Store IDs of newly created cenarios and prompt to create suite
      setImportedIds(createdIds)
      setSuitePromptOpen(true)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header actions ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
          {output && !loading && (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="outline" className="gap-2">
                  <MoreVertical className="size-4" />
                </Button>
              } />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing((v) => !v)}>
                  {isEditing ? <Check className="size-4" /> : <Pencil className="size-4" />}
                  {isEditing ? "Concluir edição" : "Editar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyMarkdown}>
                  <Copy className="size-4" />
                  Copiar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openImportSetup} disabled={isImporting}>
                  <Upload className="size-4" />
                  {isImporting ? "Importando…" : "Importar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReset}>
                  <RotateCcw className="size-4" />
                  Limpar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            onClick={generate}
            disabled={loading}
            className="gap-2"
          >
            <Sparkles className="size-4" />
            {loading ? "Gerando..." : "Gerar CT"}
          </Button>
      </div>

      {/* ── Body — tabbed card ── */}
      <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">

        {/* Tab nav */}
        <div className="flex border-b border-border-default overflow-hidden rounded-t-xl">
          {(["contexto", "cenarios"] as const).map((tab) => {
            const Icon = tab === "contexto" ? FileText : ListChecks
            const label = tab === "contexto" ? "Contexto" : "Cenários"
            const badge = tab === "cenarios" && cenarioCount > 0 ? cenarioCount : null
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 -mb-px px-4 py-3 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                    : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
                {badge !== null && (
                  <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                    activeTab === tab
                      ? "border border-brand-primary/30 bg-brand-primary/15 text-brand-primary"
                      : "bg-neutral-grey-200 text-text-secondary"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Aba: Contexto ── */}
        <div className={activeTab !== "contexto" ? "hidden" : "p-5 space-y-6"}>
          {/* Modelo de IA */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Modelo de IA <span className="text-destructive">*</span>
            </label>
            {activeIntegracoes.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">Nenhuma integração cadastrada ou ativa.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openIntModal}
                >
                  <Plus className="size-4" />
                  Adicionar Integração
                </Button>
              </div>
            ) : (
              <Select value={aiProvider} onValueChange={(v) => setAiProvider(v ?? "")}>
                <SelectTrigger>
                  <SelectValue>
                    {(() => {
                      const i = activeIntegracoes.find((it) => it.id === aiProvider)
                      if (!i) return "Selecione um modelo"
                      return (
                        <span className="flex items-center gap-2">
                          <span className="capitalize opacity-60">{i.provider}</span>
                          <span className="font-medium">{i.model}</span>
                        </span>
                      )
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {activeIntegracoes.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-text-secondary">{i.provider}</span>
                        <span className="text-sm font-medium">{i.model}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            )}
          </div>

          {/* URL do Jira — visible when Jira is configured */}
          {jiraConfigured && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                URL do Jira
              </label>
              <Input
                value={jiraInput}
                onChange={(e) => setJiraInput(e.target.value)}
                placeholder="https://agrotis.atlassian.net/browse/AC-1641 ou AC-1641"
              />
              <p className="text-xs text-text-secondary">
                O conteúdo da issue será analisado junto com o contexto e os anexos.
              </p>
            </div>
          )}

          {/* Contexto */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Contexto</label>
            <textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Cole aqui requisitos, regras de negócio ou descrição da funcionalidade."
              rows={10}
              className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
            />
          </div>

          {/* Anexos */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary flex items-center justify-between">
              <span>Anexos</span>
              {anexoPreviews.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-brand-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                  {anexoPreviews.length}
                </span>
              )}
            </label>
            <ScreenshotUploader
              previews={anexoPreviews}
              onChangePreviews={setAnexoPreviews}
            />
          </div>
        </div>

        {/* ── Aba: Cenários ── */}
        <div className={activeTab !== "cenarios" ? "hidden" : "flex min-h-125 flex-col"}>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {apiError && !loading && (
              <div className="mb-4 flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/8 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Falha ao gerar casos de teste</p>
                </div>
                <p className="pl-6 text-sm text-text-primary">{apiError}</p>
                <a
                  href="/configuracoes/modelos-de-ia"
                  className="ml-6 inline-flex w-fit items-center gap-1 text-xs text-brand-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Verificar configurações de integração
                </a>
              </div>
            )}

            {!output && !loading && !apiError && (
              <div className="flex h-full flex-col items-center justify-center gap-3 pt-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary/10">
                  <Sparkles className="size-6 text-brand-primary" />
                </div>
                <p className="text-sm text-text-secondary">
                  Preencha a aba contexto e depois clique no botão{" "}
                  <strong className="text-text-primary">Gerar CT</strong>.
                </p>
              </div>
            )}

            {loading && !output && (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="size-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                  Aguardando resposta do modelo de IA…
                </div>
              </div>
            )}

            {output && !isEditing && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="text-sm leading-[1.7] text-text-primary mb-1">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-text-primary">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-0.5 pl-1 text-sm text-text-primary mb-2">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li className="flex gap-2 text-sm leading-relaxed text-text-primary">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  hr: () => (
                    <div className="my-8 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border-default" />
                      <span className="text-[10px] font-medium uppercase tracking-widest text-text-secondary">próximo cenário</span>
                      <div className="h-px flex-1 bg-border-default" />
                    </div>
                  ),
                }}
              >
                {formatOutputAsMarkdown(output)}
              </ReactMarkdown>
            )}

            {output && isEditing && (
              <textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="h-full min-h-100 w-full resize-none bg-transparent font-sans text-sm leading-relaxed text-text-primary outline-none"
              />
            )}
          </div>
        </div>

      </div>

      {/* ── Import setup modal ── */}
      <Dialog open={importSetupOpen} onOpenChange={setImportSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Cenários Gerados</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Sistema</label>
              <Input value={sistemaSelecionado || "Nenhum sistema selecionado"} disabled />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Módulo <span className="text-destructive">*</span>
              </label>
              <Select
                value={importModule}
                onValueChange={(v) => setImportModule(v ?? "")}
                disabled={systemModuleNames.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={systemModuleNames.length === 0 ? "Nenhum módulo cadastrado" : "Selecionar módulo"} />
                </SelectTrigger>
                <SelectPopup>
                  {systemModuleNames.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <p className="text-xs text-text-secondary">Os cenários importados serão atribuídos a este módulo.</p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setImportSetupOpen(false)}>
              <X className="size-4" />
              Cancelar
            </Button>
            <Button disabled={!importModule || !sistemaSelecionado} onClick={handleImportSetupConfirm}>
              <Upload className="size-4" />
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import progress modal ── */}
      <Dialog open={importProgressOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Importando Cenários…</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-text-secondary">
              Importando cenário{" "}
              <span className="font-medium text-text-primary">{importProgress.current}</span> de{" "}
              <span className="font-medium text-text-primary">{importProgress.total}</span>…
            </p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-grey-200">
              <div
                className="h-2.5 rounded-full bg-brand-primary transition-all duration-300 ease-out"
                style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-xs font-medium text-text-secondary">
              {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import preview modal ── */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar Cenários — {importModule}</DialogTitle>
          </DialogHeader>
          {(() => {
            const total = importItems.length
            const newCount = importItems.filter((i) => !i.existing && !i.error).length
            const dupCount = importItems.filter((i) => i.existing && !i.error).length
            const errCount = importItems.filter((i) => i.error).length
            return (
              <p className="-mt-1 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{total}</span> cenário{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""} —{" "}
                <span className="font-medium text-green-600">{newCount} novo{newCount !== 1 ? "s" : ""}</span>
                {dupCount > 0 && <>, <span className="font-medium text-amber-600">{dupCount} duplicado{dupCount !== 1 ? "s" : ""}</span></>}
                {errCount > 0 && <>, <span className="font-medium text-destructive">{errCount} com erro</span></>}
              </p>
            )
          })()}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {importItems.map((item, idx) => {
              const isDup = !!item.existing
              const hasErr = !!item.error
              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                    hasErr
                      ? "border-destructive/30 bg-destructive/5"
                      : isDup
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-border-default bg-surface-card"
                  }`}
                >
                  <div className="shrink-0 pt-0.5">
                    <input
                      type="checkbox"
                      disabled={hasErr}
                      checked={item.include}
                      onChange={() => setImportItems((prev) => prev.map((x, i) => i === idx ? { ...x, include: !x.include } : x))}
                      className="size-4 cursor-pointer accent-brand-primary disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">{item.parsed.scenarioName}</span>
                      {!hasErr && !isDup && (
                        <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-green-600/30 bg-green-600/10 px-3 py-1 text-xs font-medium text-green-700">Novo</span>
                      )}
                      {!hasErr && isDup && !item.replace && (
                        <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">Já existe</span>
                      )}
                      {!hasErr && isDup && item.replace && (
                        <span className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                          <ArrowRightLeft className="size-3" />Substituir
                        </span>
                      )}
                      {hasErr && (
                        <span className="inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400">
                          <AlertCircle className="size-3" />Erro
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      {item.parsed.module && <span>Módulo: <span className="font-medium">{item.parsed.module}</span></span>}
                      {item.parsed.risco && <span>Risco: {item.parsed.risco}</span>}
                      {item.parsed.tipo && <span>Tipo: <span className="font-medium">{item.parsed.tipo}</span></span>}
                    </div>
                    {hasErr && <p className="text-xs text-destructive">{item.error}</p>}
                  </div>
                  {isDup && !hasErr && (
                    <button
                      type="button"
                      onClick={() => setCompareItem(item)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20"
                    >
                      <ArrowRightLeft className="size-3.5" />
                      Comparar
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter showCloseButton={false}>
            <div className="flex w-full items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const allSelectable = importItems.filter((i) => !i.error)
                  const allOn = allSelectable.every((i) => i.include)
                  setImportItems((prev) => prev.map((i) => i.error ? i : { ...i, include: !allOn }))
                }}
                className="text-sm text-brand-primary hover:underline"
              >
                {importItems.filter((i) => !i.error).every((i) => i.include) ? "Desmarcar todos" : "Selecionar todos"}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                  <X className="size-4" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importItems.filter((i) => i.include && !i.error).length === 0}
                >
                  <Upload className="size-4" />
                  Importar {(() => { const n = importItems.filter((i) => i.include && !i.error).length; return n > 0 ? `(${n})` : "" })()}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Comparison modal ── */}
      <Dialog open={!!compareItem} onOpenChange={(open) => { if (!open) setCompareItem(null) }}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comparar Cenário</DialogTitle>
          </DialogHeader>
          {compareItem && (
            <>
              <p className="-mt-1 text-sm text-text-secondary">
                Comparando <span className="font-medium text-text-primary">"{compareItem.parsed.scenarioName}"</span> com o cenário existente{" "}
                <span className="font-medium text-text-primary">{compareItem.existing?.id}</span>.
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-neutral-grey-50">
                    <tr className="border-b border-border-default">
                      <th className="w-36 px-3 py-2 text-left text-xs font-semibold text-text-secondary">Campo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                        Existente <span className="font-normal">({compareItem.existing?.id})</span>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                        Gerado <span className="font-normal">(IA)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map(({ label, pKey, eKey }) => {
                      const existingVal = String(compareItem.existing?.[eKey] ?? "")
                      const importedVal = String(compareItem.parsed[pKey] ?? "")
                      const isDiff = existingVal !== importedVal
                      return (
                        <tr key={label} className={`border-b border-border-default last:border-0 ${isDiff ? "bg-amber-500/10" : ""}`}>
                          <td className="align-top px-3 py-2 text-xs font-medium text-text-secondary">{label}</td>
                          <td className={`align-top whitespace-pre-wrap px-3 py-2 ${isDiff ? "text-text-secondary line-through" : "text-text-primary"}`}>
                            {existingVal || <span className="italic text-text-secondary">—</span>}
                          </td>
                          <td className={`align-top whitespace-pre-wrap px-3 py-2 ${isDiff ? "font-medium text-amber-600 dark:text-amber-400" : "text-text-primary"}`}>
                            {importedVal || <span className="italic text-text-secondary">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <DialogFooter showCloseButton={false}>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCompareItem(null)}>Fechar</Button>
                  <Button
                    onClick={() => {
                      setImportItems((prev) =>
                        prev.map((x) => x.key === compareItem.key ? { ...x, replace: true, include: true } : x)
                      )
                      setCompareItem(null)
                    }}
                  >
                    <ArrowRightLeft className="size-4" />
                    Substituir existente
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal criar integração inline ── */}
      <Dialog open={intModalOpen} onOpenChange={(open) => { if (!open) setIntModalOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Integração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Provedor */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Provedor <span className="text-destructive">*</span>
                </label>
                <Select value={intProvider} onValueChange={handleIntProviderChange} disabled={isIntModalPending}>
                  <SelectTrigger>
                    <SelectValue>
                      <span className="capitalize">{intProvider}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="openrouter">OpenRouter (Gratuito)</SelectItem>
                    <SelectItem value="groq">Groq (Llama, Mixtral)</SelectItem>
                    <SelectItem value="google">Google Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectPopup>
                </Select>
              </div>

              {/* Modelo */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">
                  Modelo <span className="text-destructive">*</span>
                </label>
                <Input
                  value={intModel}
                  onChange={(e) => setIntModel(e.target.value)}
                  placeholder="Ex.: gemini-2.0-flash, llama-3.1-70b..."
                  disabled={isIntModalPending}
                />
                {intProvider === "openrouter" && (
                  <p className="text-[10px] text-text-secondary">
                    Com visão: <span className="font-medium">google/gemini-2.0-flash-exp:free</span> · meta-llama/llama-3.2-11b-vision-instruct:free
                  </p>
                )}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                API Key <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={intShowKey ? "text" : "password"}
                    value={intApiKey}
                    onChange={(e) => { setIntApiKey(e.target.value); setIntKeyStatus("idle") }}
                    placeholder="Cole aqui a sua API Key..."
                    className="pr-16"
                    disabled={isIntModalPending}
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                    {intStatusIcon[intKeyStatus]}
                    <button
                      type="button"
                      onClick={() => setIntShowKey((v) => !v)}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                      aria-label={intShowKey ? "Ocultar chave" : "Exibir chave"}
                    >
                      {intShowKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleIntValidateKey}
                  disabled={intKeyStatus === "validating" || !intApiKey.trim() || isIntModalPending}
                  title="Verificar conexão com a API"
                  aria-label="Verificar conexão com a API"
                  className="flex size-10 shrink-0 items-center justify-center rounded-custom border border-border-default bg-surface-input text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  <ShieldCheck className="size-4" />
                </button>
              </div>
              <p className={`text-xs ${
                intKeyStatus === "valid"     ? "text-green-600" :
                intKeyStatus === "invalid"   ? "text-destructive" :
                intKeyStatus === "uncertain" ? "text-amber-600" :
                "text-text-secondary"
              }`}>
                {intKeyStatus === "idle"       && "Clique no ícone de escudo para verificar a conexão."}
                {intKeyStatus === "validating" && "Verificando conexão com a API…"}
                {intKeyStatus === "valid"      && "Chave válida — conexão com a API confirmada."}
                {intKeyStatus === "invalid"    && "Chave inválida — verifique se copiou corretamente."}
                {intKeyStatus === "uncertain"  && "Não foi possível confirmar agora. Você pode salvar assim mesmo."}
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <DialogClose render={<Button variant="outline" disabled={isIntModalPending} />}>
              <X className="size-4" />
              Cancelar
            </DialogClose>
            <Button onClick={handleSalvarIntegracao} disabled={isIntModalPending || intKeyStatus === "validating"}>
              <Check className="size-4" />
              {isIntModalPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suite Prompt Dialog ── */}
      <Dialog open={suitePromptOpen} onOpenChange={setSuitePromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Criar Suíte de Testes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            {importedIds.length} cenário{importedIds.length !== 1 ? "s" : ""} importado{importedIds.length !== 1 ? "s" : ""} com sucesso.
            Deseja criar uma nova Suíte de Testes com esses cenários?
          </p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setSuitePromptOpen(false)}>
              Agora não
            </Button>
            <Button onClick={() => {
              setSuitePromptOpen(false)
              router.push(`/suites/nova?cenarios=${importedIds.join(",")}`)
            }}>
              Criar Suíte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Screenshot / Annexo uploader ─────────────────────────────────────────────

interface ScreenshotUploaderProps {
  previews: { name: string; dataUrl: string }[]
  onChangePreviews: (v: { name: string; dataUrl: string }[]) => void
}

function ScreenshotUploader({ previews, onChangePreviews }: ScreenshotUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const allowed = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    )
    if (allowed.length === 0) { toast.error("Selecione arquivos de imagem (PNG, JPG, etc.) ou PDF."); return }

    const readers = allowed.map(
      (file) =>
        new Promise<{ name: string; dataUrl: string }>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ name: file.name, dataUrl: reader.result as string })
          reader.readAsDataURL(file)
        })
    )

    Promise.all(readers).then((results) => {
      onChangePreviews([...previews, ...results])
    })
  }

  function removePreview(index: number) {
    onChangePreviews(previews.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-custom border-2 border-dashed border-border-default bg-surface-input text-text-secondary transition-colors hover:border-brand-primary/50 hover:bg-neutral-grey-100"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        aria-label="Clique ou arraste imagens ou PDFs para anexar"
      >
        <CloudUpload className="size-8" />
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">Upload de imagem ou PDF</p>
          <p className="text-xs text-text-secondary">PNG, JPG, WebP, PDF — múltiplos arquivos</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {previews.map((p, i) => (
            <div key={i} className="group relative">
              {p.dataUrl.startsWith("data:application/pdf") ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border-default bg-neutral-grey-100">
                  <FileText className="size-8 text-text-secondary" />
                </div>
              ) : (
                <img
                  src={p.dataUrl}
                  alt={p.name}
                  className="h-20 w-20 rounded-md border border-border-default object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removePreview(i)}
                aria-label={`Remover ${p.name}`}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm ring-1 ring-white/30 transition-transform hover:scale-110"
              >
                <Trash2 size={14} color="white" strokeWidth={2.5} />
              </button>
              <p className="mt-1 max-w-20 truncate text-[10px] text-text-secondary">{p.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
