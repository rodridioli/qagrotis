"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { CenarioRecord } from "@/lib/actions/cenarios"

interface Props {
  open: boolean
  onClose: () => void
  cenario: CenarioRecord
  manualAttachments: File[]
  autoAttachments: File[]
}

function parseIssueKey(input: string): string {
  const trimmed = input.trim()
  if (trimmed.includes("/")) return trimmed.split("/").pop() ?? trimmed
  return trimmed
}

function fieldMd(label: string, value: string | undefined | null): string {
  const v = (value && value.trim()) ? value.trim() : "—"
  if (v === "—") return `**${label}:** —`
  if (v.includes("\n")) {
    return `**${label}:**\n\n${v}`
  }
  return `**${label}:** ${v}`
}

function buildContent(cenario: CenarioRecord, manualNames: string[], autoNames: string[]): string {
  const exportDate = new Date().toLocaleDateString("pt-BR")

  const lines: string[] = [
    `## ${cenario.id} — ${cenario.scenarioName}`,
    `*Exportado em ${exportDate}*`,
    ``,
    fieldMd("Sistema", cenario.system),
    fieldMd("Módulo", cenario.module),
    fieldMd("Tipo", cenario.tipo),
    fieldMd("Risco", cenario.risco),
    fieldMd("Descrição", cenario.descricao),
    fieldMd("Regra de Negócio", cenario.regraDeNegocio),
    fieldMd("Pré-condições", cenario.preCondicoes),
    fieldMd("BDD (Gherkin)", cenario.bdd),
    fieldMd("Resultado Esperado", cenario.resultadoEsperado),
  ]

  if (manualNames.length > 0) {
    lines.push(``, `## Evidências — Teste Manual`, ``)
    manualNames.forEach((n) => lines.push(`- ${n}`))
  }

  if (autoNames.length > 0) {
    lines.push(``, `## Evidências — Automação`, ``)
    autoNames.forEach((n) => lines.push(`- ${n}`))
  }

  return lines.join("\n")
}

function getJiraCredentials() {
  return {
    jiraUrl: localStorage.getItem("jira_url") ?? "",
    email: localStorage.getItem("jira_email") ?? "",
    apiToken: localStorage.getItem("jira_token") ?? "",
  }
}

async function uploadFilesToJira(issueKey: string, files: File[]): Promise<string[]> {
  if (files.length === 0) return []
  const fd = new FormData()
  fd.append("issueKey", issueKey)
  files.forEach((f) => fd.append("files", f, f.name))
  try {
    const res = await fetch("/api/jira/attachments", { method: "POST", body: fd })
    if (!res.ok) return []
    const data = await res.json() as { uploaded: string[] }
    return data.uploaded
  } catch {
    return []
  }
}

export function JiraExportModal({ open, onClose, cenario, manualAttachments, autoAttachments }: Props) {
  const router = useRouter()
  const [issueInput, setIssueInput] = useState("")
  const [inputTouched, setInputTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [existing, setExisting] = useState<{ summary: string; descText: string } | null>(null)

  const hasAttachments = manualAttachments.length > 0 || autoAttachments.length > 0

  function handleClose() {
    setIssueInput("")
    setInputTouched(false)
    setExisting(null)
    onClose()
  }

  async function handleCheckIssue() {
    const key = parseIssueKey(issueInput)
    if (!key) { toast.error("Informe a URL ou chave da issue."); return }

    const creds = getJiraCredentials()
    if (!creds.jiraUrl || !creds.email || !creds.apiToken) {
      toast.error("Configure a Integração Jira em Configurações antes de exportar.", {
        action: { label: "Configurar", onClick: () => router.push("/configuracoes") },
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", jiraUrl: creds.jiraUrl, issueKey: key, email: creds.email, apiToken: creds.apiToken }),
      })
      if (!res.ok) {
        const err = await res.text()
        toast.error(`Erro ao buscar issue: ${err.slice(0, 150)}`)
        return
      }
      const data = await res.json() as { summary: string; descText: string; hasContent: boolean }
      if (data.hasContent) {
        setExisting(data)
      } else {
        await doExport(key, creds, "replace")
      }
    } catch {
      toast.error("Não foi possível conectar ao Jira.")
    } finally {
      setLoading(false)
    }
  }

  async function doExport(
    issueKey: string,
    creds: { jiraUrl: string; email: string; apiToken: string },
    mode: "replace" | "append",
  ) {
    setLoading(true)
    try {
      const allFiles = [...manualAttachments, ...autoAttachments]
      const uploadedNames = await uploadFilesToJira(issueKey, allFiles)

      const content = buildContent(
        cenario,
        manualAttachments.map((f) => f.name),
        autoAttachments.map((f) => f.name),
      )

      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUrl: creds.jiraUrl, issueKey, apiToken: creds.apiToken, email: creds.email, content, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as string) || "Erro ao enviar para o Jira.")

      const uploadMsg = allFiles.length > 0
        ? ` ${uploadedNames.length}/${allFiles.length} arquivo(s) anexado(s).`
        : ""

      toast.success("Exportado para o Jira com sucesso!", {
        description: `Issue ${issueKey} atualizada.${uploadMsg}`,
        action: { label: "Abrir no Jira", onClick: () => window.open((data as { url: string }).url, "_blank") },
      })
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar com o Jira.")
    } finally {
      setLoading(false)
    }
  }

  const issueKey = parseIssueKey(issueInput)

  return (
    <>
      {/* Passo 1 — URL/Chave da issue */}
      <Dialog open={open && !existing} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar para o Jira</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                URL ou chave da issue <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="https://agrotis.atlassian.net/browse/UX-951 ou UX-951"
                value={issueInput}
                onChange={(e) => setIssueInput(e.target.value)}
                onBlur={() => setInputTouched(true)}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleCheckIssue() }}
                autoFocus
              />
              {inputTouched && !issueInput.trim() && (
                <p className="text-xs text-destructive">Campo obrigatório.</p>
              )}
            </div>

            {hasAttachments && (
              <div className="rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2 space-y-1">
                <p className="text-xs font-medium text-text-secondary">Evidências que serão anexadas:</p>
                {manualAttachments.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium">Teste Manual:</span> {manualAttachments.map((f) => f.name).join(", ")}
                  </p>
                )}
                {autoAttachments.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    <span className="font-medium">Automação:</span> {autoAttachments.map((f) => f.name).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleCheckIssue} disabled={loading || !issueInput.trim()}>
              {loading ? "Verificando..." : "Exportar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passo 2 — Conteúdo existente */}
      <Dialog open={open && existing !== null} onOpenChange={(v) => { if (!v) setExisting(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{existing?.summary || issueKey}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-text-secondary">
              Esta issue já possui conteúdo na descrição. Como deseja prosseguir?
            </p>
            <div className="max-h-40 overflow-y-auto rounded-custom border border-border-default bg-neutral-grey-50 px-3 py-2">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                {(existing?.descText ?? "").length > 800
                  ? (existing?.descText ?? "").slice(0, 800) + "..."
                  : (existing?.descText ?? "")}
              </pre>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setExisting(null)} disabled={loading}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={() => { const creds = getJiraCredentials(); doExport(issueKey, creds, "replace") }}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Substituir"}
            </Button>
            <Button
              onClick={() => { const creds = getJiraCredentials(); doExport(issueKey, creds, "append") }}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Acrescentar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
