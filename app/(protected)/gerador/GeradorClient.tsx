"use client"

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Sparkles, Copy, RotateCcw, ChevronDown, ChevronUp,
  Pencil, Check, Upload, X, ArrowRightLeft, AlertCircle, CloudUpload,
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
import { toast } from "sonner"
import { criarCenario, atualizarCenario, type CenarioRecord } from "@/lib/actions/cenarios"
import { useSistemaSelecionado } from "@/lib/modulo-context"
import type { ModuloRecord } from "@/lib/actions/modulos"

// ── AI Providers ─────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { value: "copilot",  label: "Microsoft Copilot (GPT-4o)",  description: "GPT-4o via OpenAI — requer OPENAI_API_KEY" },
  { value: "gemini",   label: "Google Gemini 2.0 Flash Lite", description: "Gratuito — requer GOOGLE_API_KEY" },
  { value: "claude",   label: "Anthropic Claude 3.5",        description: "Requer ANTHROPIC_API_KEY" },
  { value: "llama",    label: "Meta Llama 3.1 (Groq)",       description: "Gratuito — requer GROQ_API_KEY" },
  { value: "mistral",  label: "Mistral Large (Groq)",        description: "Gratuito — requer GROQ_API_KEY" },
]

// ── Import types (same as CenariosClient) ────────────────────────────────────

interface ParsedCenario {
  scenarioName: string
  module: string
  client: string
  risco: string
  tipo: "Manual" | "Automatizado" | "Man./Auto."
  descricao: string
  caminhoTela: string
  regraDeNegocio: string
  preCondicoes: string
  bdd: string
  resultadoEsperado: string
}

interface ImportItem {
  key: string
  parsed: ParsedCenario
  existing: CenarioRecord | null
  include: boolean
  replace: boolean
  error?: string
}

const COMPARE_FIELDS: Array<{ label: string; pKey: keyof ParsedCenario; eKey: keyof CenarioRecord }> = [
  { label: "Módulo",             pKey: "module",            eKey: "module" },
  { label: "Cliente",            pKey: "client",            eKey: "client" },
  { label: "Risco",              pKey: "risco",             eKey: "risco" },
  { label: "Tipo",               pKey: "tipo",              eKey: "tipo" },
  { label: "Descrição",          pKey: "descricao",         eKey: "descricao" },
  { label: "Caminho da Tela",    pKey: "caminhoTela",       eKey: "caminhoTela" },
  { label: "Regra de Negócio",   pKey: "regraDeNegocio",    eKey: "regraDeNegocio" },
  { label: "Pré-condições",      pKey: "preCondicoes",      eKey: "preCondicoes" },
  { label: "BDD (Gherkin)",      pKey: "bdd",               eKey: "bdd" },
  { label: "Resultado Esperado", pKey: "resultadoEsperado", eKey: "resultadoEsperado" },
]

// ── Markdown parser (same logic as CenariosClient) ───────────────────────────

function parseMarkdownCenarios(text: string): ParsedCenario[] {
  const normalized = text.replace(/\\([*#\-`![\](){}|>])/g, "$1")
  const rawBlocks = normalized.split(/\n---+\n?/)
  const blocks: string[] = []
  for (const raw of rawBlocks) {
    const parts = raw.trim().split(/\n(?=#{1,2}\s)/)
    blocks.push(...parts)
  }

  const results: ParsedCenario[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const lines = trimmed.split(/\r?\n/)

    let name = ""
    for (const line of lines) {
      const m = line.match(/^#{1,2}\s+(.+)/)
      if (m) {
        name = m[1]
          .replace(/^cenário:\s*/i, "")
          .replace(/^ct-?\d+\s*[-–:]\s*/i, "")
          .trim()
        break
      }
    }
    if (!name) continue

    function isHeader(line: string): boolean {
      return /^\s*\*\*[^*\n]+\*\*\s*:?\s*$/.test(line) || /^#{1,4}\s/.test(line)
    }

    function getField(keys: string[]): string {
      const esc = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      const kp = esc.join("|")
      const reSameLine  = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]+\\*\\*\\s*(\\S.*)$`, "i")
      const reSameLine2 = new RegExp(`^\\s*\\*\\*(${kp})\\*\\*[:\\s]+(\\S.*)$`, "i")
      const reHeader    = new RegExp(`^\\s*\\*\\*(${kp})[:\\s]*\\*\\*\\s*$`, "i")
      const reHeading   = new RegExp(`^#{2,4}\\s+(${kp})\\s*$`, "i")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const m = line.match(reSameLine) ?? line.match(reSameLine2)
        if (m) return (m[2] ?? "").trim()
        if (reHeader.test(line) || reHeading.test(line)) {
          const buf: string[] = []
          for (let j = i + 1; j < lines.length; j++) {
            if (isHeader(lines[j])) break
            buf.push(lines[j])
          }
          return buf.filter((l) => l.trim()).join(" ").trim()
        }
      }
      return ""
    }

    const tipoRaw = getField(["tipo", "type"])
    const tipo: "Manual" | "Automatizado" | "Man./Auto." =
      /man.*auto|auto.*man/i.test(tipoRaw) ? "Man./Auto." :
      /auto/i.test(tipoRaw) ? "Automatizado" : "Manual"

    const riscoRaw = getField(["risco", "risk", "prioridade", "priority"])
    const risco =
      /alto|high/i.test(riscoRaw) ? "Alto" :
      /baixo|low/i.test(riscoRaw) ? "Baixo" : "Médio"

    results.push({
      scenarioName:      name,
      module:            getField(["módulo", "modulo", "module"]),
      client:            getField(["cliente", "client"]),
      risco,
      tipo,
      descricao:         getField(["descrição", "descricao", "description", "objetivo"]),
      caminhoTela:       getField(["caminho da tela", "caminho", "screen path", "path"]),
      regraDeNegocio:    getField(["regra de negócio", "regra de negocio", "regra", "business rule"]),
      preCondicoes:      getField(["pré-condições", "pré condições", "pre-condições", "pre-condicoes", "preconditions"]),
      bdd:               getField(["cenário", "cenario", "bdd (gherkin)", "bdd", "gherkin", "scenario"]),
      resultadoEsperado: getField(["resultados esperados", "resultado esperado", "resultado", "resultados", "expected result"]),
    })
  }
  return results
}

// ── Component ────────────────────────────────────────────────────────────────

interface SectionState {
  contextoOpen: boolean
  anexosOpen: boolean
}

interface Props {
  initialCenarios: CenarioRecord[]
  allModulos: ModuloRecord[]
}

export function GeradorClient({ initialCenarios, allModulos }: Props) {
  const router = useRouter()
  const { sistemaSelecionado } = useSistemaSelecionado()

  const [contexto, setContexto] = useState("")
  const [sections, setSections] = useState<SectionState>({
    contextoOpen: true,
    anexosOpen: false,
  })
  const [aiProvider, setAiProvider] = useState("copilot")
  const [apiKey, setApiKey] = useState("")
  const [output, setOutput] = useState("")
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

  const systemModuleNames = useMemo(
    () => allModulos.filter((m) => m.active && m.sistemaName === sistemaSelecionado).map((m) => m.name),
    [allModulos, sistemaSelecionado]
  )

  function toggle(key: keyof SectionState) {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  async function generate() {
    if (!contexto && anexoPreviews.length === 0) {
      toast.error("Informe ao menos um contexto ou anexo antes de gerar.")
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setOutput("")
    setIsEditing(false)
    setLoading(true)

    try {
      const anexosDesc = anexoPreviews.length > 0
        ? `Imagens anexadas: ${anexoPreviews.map((p) => p.name).join(", ")}`
        : ""

      const res = await fetch("/api/gerador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jira: contexto, imagens: anexosDesc, provider: aiProvider, apiKey: apiKey.trim() || undefined }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const msg = await res.text()
        toast.error(msg || "Erro ao gerar casos de teste.")
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

  function handleCopyMarkdown() {
    navigator.clipboard.writeText(output)
    toast.success("Markdown copiado! Cole diretamente no Jira.")
  }

  function handleReset() {
    abortRef.current?.abort()
    setContexto("")
    setAnexoPreviews([])
    setOutput("")
    setIsEditing(false)
    setLoading(false)
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

    const norm = (s: string) => s.toLowerCase().trim()
    const items: ImportItem[] = parsed.map((p, idx) => {
      const pFinal: ParsedCenario = { ...p, module: importModule }
      const existing = initialCenarios.find(
        (c) => c.active && norm(c.scenarioName) === norm(p.scenarioName)
      ) ?? null
      let error: string | undefined
      if (!pFinal.descricao && !pFinal.bdd && !pFinal.regraDeNegocio) {
        error = "Nenhum conteúdo descritivo encontrado"
      }
      return { key: `${idx}-${p.scenarioName}`, parsed: pFinal, existing, include: !error, replace: false, error }
    })
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
    try {
      for (let i = 0; i < toImport.length; i++) {
        const item = toImport[i]
        const payload = {
          scenarioName:      item.parsed.scenarioName,
          system:            sistemaSelecionado,
          module:            item.parsed.module,
          client:            item.parsed.client,
          risco:             item.parsed.risco,
          tipo:              item.parsed.tipo,
          descricao:         item.parsed.descricao || item.parsed.bdd || "-",
          caminhoTela:       item.parsed.caminhoTela,
          regraDeNegocio:    item.parsed.regraDeNegocio || "Não informado.",
          preCondicoes:      item.parsed.preCondicoes,
          bdd:               item.parsed.bdd,
          resultadoEsperado: item.parsed.resultadoEsperado || "-",
          urlScript: "",
          steps: [],
          deps: [],
        }
        try {
          if (item.replace && item.existing) {
            await atualizarCenario(item.existing.id, payload)
          } else {
            await criarCenario(payload)
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
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header actions ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
          {output && !loading && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing((v) => !v)}
                className="gap-2"
              >
                {isEditing ? <Check className="size-4" /> : <Pencil className="size-4" />}
                {isEditing ? "Concluir edição" : "Editar"}
              </Button>
              <Button variant="outline" onClick={handleCopyMarkdown} className="gap-2">
                <Copy className="size-4" />
                Copiar para Jira (Markdown)
              </Button>
              <Button
                variant="outline"
                onClick={openImportSetup}
                disabled={isImporting}
                className="gap-2"
              >
                <Upload className="size-4" />
                {isImporting ? "Importando…" : "Importar Cenários"}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleReset} disabled={loading} className="gap-2">
            <RotateCcw className="size-4" />
            Limpar
          </Button>
          <Button onClick={generate} disabled={loading} className="gap-2">
            <Sparkles className="size-4" />
            {loading ? "Gerando..." : "Gerar casos de teste"}
          </Button>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left — inputs */}
        <div className="space-y-3">
          {/* Motor de IA + API Key */}
          <div className="rounded-xl bg-surface-card p-5 shadow-card">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Motor de IA</label>
                <Select value={aiProvider} onValueChange={(v) => setAiProvider(v ?? "copilot")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectPopup>
                    {AI_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Cole sua chave de API aqui…"
                  className="font-mono"
                />
                <p className="text-xs text-text-secondary">
                  {AI_PROVIDERS.find((p) => p.value === aiProvider)?.description}
                </p>
              </div>
            </div>
          </div>

          {/* Contexto (was JIRA / História) */}
          <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
            <button
              type="button"
              onClick={() => toggle("contextoOpen")}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary transition-colors hover:bg-neutral-grey-50"
            >
              <span>Contexto</span>
              {sections.contextoOpen
                ? <ChevronUp className="size-4 text-text-secondary" />
                : <ChevronDown className="size-4 text-text-secondary" />}
            </button>
            {sections.contextoOpen && (
              <div className="px-5 pb-5">
                <textarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  placeholder="Cole aqui o texto da tarefa do Jira, história de usuário, requisito ou qualquer contexto relevante..."
                  rows={8}
                  className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Anexos (was Screenshots) */}
          <div className="overflow-hidden rounded-xl bg-surface-card shadow-card">
            <button
              type="button"
              onClick={() => toggle("anexosOpen")}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary transition-colors hover:bg-neutral-grey-50"
            >
              <span>
                Anexos
                {anexoPreviews.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-brand-primary/15 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                    {anexoPreviews.length}
                  </span>
                )}
              </span>
              {sections.anexosOpen
                ? <ChevronUp className="size-4 text-text-secondary" />
                : <ChevronDown className="size-4 text-text-secondary" />}
            </button>
            {sections.anexosOpen && (
              <div className="px-5 pb-5">
                <ScreenshotUploader
                  previews={anexoPreviews}
                  onChangePreviews={setAnexoPreviews}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right — output */}
        <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl bg-surface-card shadow-card">
          <div className="border-b border-border-default px-5 py-4">
            <h2 className="text-sm font-semibold text-text-primary">Casos de teste gerados</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!output && !loading && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary/10">
                  <Sparkles className="size-6 text-brand-primary" />
                </div>
                <p className="max-w-xs text-sm text-text-secondary">
                  Preencha o contexto à esquerda e clique em{" "}
                  <strong className="text-text-primary">Gerar casos de teste</strong>.
                </p>
              </div>
            )}

            {loading && !output && (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="size-4 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                  Gerando casos de teste...
                </div>
              </div>
            )}

            {output && !isEditing && (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-primary">
                {output}
              </pre>
            )}

            {output && isEditing && (
              <textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="h-full min-h-[400px] w-full resize-none bg-transparent font-sans text-sm leading-relaxed text-text-primary outline-none"
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
                      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
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
                      {item.parsed.risco && <span>Risco: <span className="font-medium">{item.parsed.risco}</span></span>}
                      {item.parsed.tipo && <span>Tipo: <span className="font-medium">{item.parsed.tipo}</span></span>}
                    </div>
                    {hasErr && <p className="text-xs text-destructive">{item.error}</p>}
                  </div>
                  {isDup && !hasErr && (
                    <button
                      type="button"
                      onClick={() => setCompareItem(item)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
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
                        <tr key={label} className={`border-b border-border-default last:border-0 ${isDiff ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                          <td className="align-top px-3 py-2 text-xs font-medium text-text-secondary">{label}</td>
                          <td className={`align-top whitespace-pre-wrap px-3 py-2 ${isDiff ? "text-text-secondary line-through" : "text-text-primary"}`}>
                            {existingVal || <span className="italic text-text-secondary">—</span>}
                          </td>
                          <td className={`align-top whitespace-pre-wrap px-3 py-2 ${isDiff ? "font-medium text-amber-800 dark:text-amber-400" : "text-text-primary"}`}>
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
    const allowed = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (allowed.length === 0) { toast.error("Selecione arquivos de imagem (PNG, JPG, etc.)"); return }

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
        aria-label="Clique ou arraste imagens para anexar"
      >
        <CloudUpload className="size-8" />
        <div className="text-center">
          <p className="text-sm font-medium text-text-primary">Upload de imagem</p>
          <p className="text-xs text-text-secondary">PNG, JPG, GIF, WebP — múltiplos arquivos</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="group relative">
              <img
                src={p.dataUrl}
                alt={p.name}
                className="h-20 w-20 rounded-md border border-border-default object-cover"
              />
              <button
                type="button"
                onClick={() => removePreview(i)}
                aria-label={`Remover ${p.name}`}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 dark:bg-red-400 text-xs leading-none text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                ×
              </button>
              <p className="mt-1 max-w-[80px] truncate text-[10px] text-text-secondary">{p.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
