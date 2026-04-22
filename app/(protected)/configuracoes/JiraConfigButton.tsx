"use client"

import { useState } from "react"
import { PanelsTopLeft } from "lucide-react"
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

interface Props {
  defaultEmail?: string
}

export default function JiraConfigButton({ defaultEmail = "" }: Props) {
  const [open, setOpen] = useState(false)
  const [jiraUrl, setJiraUrl] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("jira_url") || "https://agrotis.atlassian.net/"
      : "https://agrotis.atlassian.net/"
  )
  const [email, setEmail] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("jira_email") || defaultEmail
      : defaultEmail
  )
  const [token, setToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("jira_token") || "" : ""
  )
  const [saving, setSaving] = useState(false)

  async function handleOpen() {
    setJiraUrl(localStorage.getItem("jira_url") || "https://agrotis.atlassian.net/")
    setEmail(localStorage.getItem("jira_email") || defaultEmail)
    setToken(localStorage.getItem("jira_token") || "")
    try {
      const r = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (r.ok) {
        const d = (await r.json()) as {
          jiraUrl?: string
          jiraEmail?: string
          hasToken?: boolean
        }
        if (d.jiraUrl) setJiraUrl(d.jiraUrl)
        if (d.jiraEmail) setEmail(d.jiraEmail)
        if (d.hasToken) localStorage.setItem("jira_cookie_ok", "1")
      }
    } catch {
      /* ignora rede */
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!jiraUrl.trim() || !email.trim() || !token.trim()) {
      toast.error("Todos os campos são obrigatórios.")
      return
    }
    setSaving(true)
    try {
      // First validate credentials against Jira
      const validateRes = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch", jiraUrl: jiraUrl.trim(), issueKey: "TEST-1", email: email.trim(), apiToken: token.trim() }),
      })
      if (!validateRes.ok && validateRes.status !== 404 && (validateRes.status === 401 || validateRes.status === 403)) {
        toast.error("Credenciais inválidas. Verifique o e-mail e o API Token.")
        return
      }
      // Save to httpOnly cookies (secure, not accessible by JS)
      const saveRes = await fetch("/api/jira/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUrl: jiraUrl.trim(), jiraEmail: email.trim(), jiraToken: token.trim() }),
      })
      if (!saveRes.ok) throw new Error("Erro ao salvar credenciais.")
      // Keep localStorage for backward compat with existing code that reads it
      localStorage.setItem("jira_url", jiraUrl.trim())
      localStorage.setItem("jira_email", email.trim())
      localStorage.setItem("jira_token", token.trim())
      localStorage.setItem("jira_cookie_ok", "1")
      window.dispatchEvent(new Event("jira-credentials-synced"))
      toast.success("Configuração do Jira salva com sucesso.")
      setOpen(false)
    } catch {
      toast.error("Não foi possível conectar ao Jira. Verifique a URL.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50 w-full"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
          <PanelsTopLeft className="size-6" />
        </div>
        <span className="font-semibold text-text-primary">Integração Jira</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Integração Jira</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-text-secondary">
              Configure as credenciais para exportar históricos e usar o Gerador com issues do Jira. URL, e-mail e token são gravados em cookies seguros no servidor (persistem mesmo se você limpar apenas o armazenamento local do site).
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Jira <span className="text-destructive">*</span></label>
              <Input placeholder="https://empresa.atlassian.net" value={jiraUrl} onChange={(e) => setJiraUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">E-mail da conta Jira <span className="text-destructive">*</span></label>
              <Input placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">API Token <span className="text-destructive">*</span></label>
              <Input type="password" placeholder="••••••••••••••••••••" value={token} onChange={(e) => setToken(e.target.value)} />
              <p className="text-xs text-text-secondary">
                Gere em{" "}
                <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">
                  id.atlassian.com
                </a>
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !jiraUrl.trim() || !email.trim() || !token.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
