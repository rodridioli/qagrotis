"use client"

import { useState, useRef } from "react"
import { Sparkles, Copy, RotateCcw, ChevronDown, ChevronUp, Download, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface SectionState {
  jiraOpen: boolean
  contextoOpen: boolean
  imagensOpen: boolean
}

export function GeradorClient() {
  const [jira, setJira] = useState("")
  const [contexto, setContexto] = useState("")
  const [imagens, setImagens] = useState("")
  const [sections, setSections] = useState<SectionState>({
    jiraOpen: true,
    contextoOpen: false,
    imagensOpen: false,
  })
  const [output, setOutput] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  function toggle(key: keyof SectionState) {
    setSections((s) => ({ ...s, [key]: !s[key] }))
  }

  async function generate() {
    if (!jira && !contexto && !imagens) {
      toast.error("Informe ao menos uma entrada antes de gerar.")
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setOutput("")
    setIsEditing(false)
    setLoading(true)

    try {
      const res = await fetch("/api/gerador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jira, contexto, imagens }),
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

  function handleCopy() {
    navigator.clipboard.writeText(output)
    toast.success("Copiado para a área de transferência.")
  }

  function handleExportJira() {
    // Jira uses its own wiki markup but accepts markdown when pasted in description fields.
    // We copy the raw markdown — paste directly into any Jira text field.
    navigator.clipboard.writeText(output)
    toast.success("Markdown copiado! Cole no campo de texto do Jira.")
  }

  function handleReset() {
    abortRef.current?.abort()
    setJira("")
    setContexto("")
    setImagens("")
    setOutput("")
    setIsEditing(false)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      {/* ── Header actions (same pattern as other pages) ── */}
      <div className="flex flex-wrap items-center justify-end gap-3">
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
            <Button variant="outline" onClick={handleCopy} className="gap-2">
              <Copy className="size-4" />
              Copiar
            </Button>
            <Button variant="outline" onClick={handleExportJira} className="gap-2">
              <Download className="size-4" />
              Exportar para Jira
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
          {/* JIRA */}
          <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle("jiraOpen")}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary hover:bg-neutral-grey-50 transition-colors"
            >
              <span>JIRA / História</span>
              {sections.jiraOpen
                ? <ChevronUp className="size-4 text-text-secondary" />
                : <ChevronDown className="size-4 text-text-secondary" />}
            </button>
            {sections.jiraOpen && (
              <div className="px-5 pb-5">
                <textarea
                  value={jira}
                  onChange={(e) => setJira(e.target.value)}
                  placeholder="Cole aqui o texto da tarefa do Jira, história de usuário ou requisito..."
                  rows={6}
                  className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Contexto */}
          <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle("contextoOpen")}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary hover:bg-neutral-grey-50 transition-colors"
            >
              <span>Contexto adicional</span>
              {sections.contextoOpen
                ? <ChevronUp className="size-4 text-text-secondary" />
                : <ChevronDown className="size-4 text-text-secondary" />}
            </button>
            {sections.contextoOpen && (
              <div className="px-5 pb-5">
                <textarea
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  placeholder="Regras de negócio, fluxos, restrições, comportamentos esperados..."
                  rows={6}
                  className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Screenshots */}
          <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle("imagensOpen")}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-text-primary hover:bg-neutral-grey-50 transition-colors"
            >
              <span>Screenshots</span>
              {sections.imagensOpen
                ? <ChevronUp className="size-4 text-text-secondary" />
                : <ChevronDown className="size-4 text-text-secondary" />}
            </button>
            {sections.imagensOpen && (
              <div className="px-5 pb-5">
                <ScreenshotUploader value={imagens} onChange={setImagens} />
              </div>
            )}
          </div>
        </div>

        {/* Right — output */}
        <div className="rounded-xl bg-surface-card shadow-card overflow-hidden flex flex-col min-h-[500px]">
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
                  Preencha ao menos um campo à esquerda e clique em{" "}
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
              <pre className="whitespace-pre-wrap font-sans text-sm text-text-primary leading-relaxed">
                {output}
              </pre>
            )}

            {output && isEditing && (
              <textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="w-full h-full min-h-[400px] resize-none bg-transparent font-sans text-sm text-text-primary leading-relaxed outline-none"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screenshot uploader ───────────────────────────────────────────────────────

interface ScreenshotUploaderProps {
  value: string
  onChange: (v: string) => void
}

function ScreenshotUploader({ value, onChange }: ScreenshotUploaderProps) {
  const [previews, setPreviews] = useState<{ name: string; dataUrl: string }[]>([])
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
      setPreviews((prev) => [...prev, ...results])
      // Build description for the AI: list file names so it knows what was attached
      const names = [...previews, ...results].map((r) => r.name).join(", ")
      onChange(`Imagens anexadas: ${names}`)
    })
  }

  function removePreview(index: number) {
    const next = previews.filter((_, i) => i !== index)
    setPreviews(next)
    if (next.length === 0) onChange("")
    else onChange(`Imagens anexadas: ${next.map((r) => r.name).join(", ")}`)
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-custom border-2 border-dashed border-border-default px-4 py-8 text-center transition-colors hover:border-brand-primary/50 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <p className="text-sm text-text-secondary">
          Arraste screenshots aqui ou{" "}
          <span className="font-medium text-brand-primary">clique para selecionar</span>
        </p>
        <p className="text-xs text-text-secondary/60">PNG, JPG, GIF, WebP</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Previews */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <div key={i} className="relative group">
              <img
                src={p.dataUrl}
                alt={p.name}
                className="h-20 w-20 rounded-md border border-border-default object-cover"
              />
              <button
                type="button"
                onClick={() => removePreview(i)}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
              >
                ×
              </button>
              <p className="mt-1 max-w-[80px] truncate text-[10px] text-text-secondary">{p.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Manual description fallback */}
      <textarea
        value={value.startsWith("Imagens anexadas:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou descreva as telas manualmente..."
        rows={3}
        className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-colors"
      />
    </div>
  )
}
