"use client"

import { useState } from "react"
import { Check, Loader2, PanelsTopLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CancelActionButton } from "@/components/shared/CancelActionButton"
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
  const [jiraUrl, setJiraUrl] = useState("https://agrotis.atlassian.net/")
  const [email, setEmail] = useState(defaultEmail)
  const [token, setToken] = useState("")
  const [hasStoredToken, setHasStoredToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ jiraUrl?: boolean; email?: boolean; token?: boolean }>({})

  async function handleOpen() {
    setToken("")
    setHasStoredToken(false)
    try {
      const r = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (r.ok) {
        const d = (await r.json()) as {
          jiraUrl?: string
          jiraEmail?: string
          hasToken?: boolean
        }
        setJiraUrl(d.jiraUrl?.trim() || "https://agrotis.atlassian.net/")
        setEmail(d.jiraEmail?.trim() || defaultEmail)
        setHasStoredToken(!!d.hasToken)
      } else {
        setJiraUrl("https://agrotis.atlassian.net/")
        setEmail(defaultEmail)
      }
    } catch {
      setJiraUrl("https://agrotis.atlassian.net/")
      setEmail(defaultEmail)
    }
    setOpen(true)
  }

  async function handleSave() {
    const e: typeof fieldErrors = {}
    if (!jiraUrl.trim()) e.jiraUrl = true
    if (!email.trim()) e.email = true
    if (!token.trim() && !hasStoredToken) e.token = true
    if (Object.keys(e).length > 0) {
      setFieldErrors(e)
      if (e.jiraUrl || e.email) toast.error("URL e e-mail são obrigatórios.")
      else toast.error("Informe o API Token.")
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      if (token.trim()) {
        const validateRes = await fetch("/api/jira", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "fetch",
            jiraUrl: jiraUrl.trim(),
            issueKey: "TEST-1",
            email: email.trim(),
            apiToken: token.trim(),
          }),
        })
        if (!validateRes.ok && validateRes.status !== 404 && (validateRes.status === 401 || validateRes.status === 403)) {
          toast.error("Credenciais inválidas. Verifique o e-mail e o API Token.")
          return
        }
      }

      const saveRes = await fetch("/api/jira/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jiraUrl: jiraUrl.trim(),
          jiraEmail: email.trim(),
          ...(token.trim() ? { jiraToken: token.trim() } : {}),
        }),
      })
      if (!saveRes.ok) {
        const t = await saveRes.text().catch(() => "")
        throw new Error(t || "Erro ao salvar credenciais.")
      }

      try {
        ;["jira_url", "jira_email", "jira_token", "jira_cookie_ok"].forEach((k) => localStorage.removeItem(k))
      } catch {
        /* ignore */
      }
      setHasStoredToken(true)
      setToken("")
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">URL do Jira <span className="text-destructive">*</span></label>
              <Input placeholder="https://empresa.atlassian.net" value={jiraUrl} onChange={(e) => { setJiraUrl(e.target.value); setFieldErrors(p => ({ ...p, jiraUrl: false })) }} aria-invalid={!!fieldErrors.jiraUrl} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">E-mail da conta Jira <span className="text-destructive">*</span></label>
              <Input placeholder="seu@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: false })) }} aria-invalid={!!fieldErrors.email} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">API Token {!hasStoredToken && <span className="text-destructive">*</span>}</label>
              <Input type="password" placeholder={hasStoredToken ? "Deixe em branco para manter o token atual" : "••••••••••••••••••••"} value={token} onChange={(e) => { setToken(e.target.value); setFieldErrors(p => ({ ...p, token: false })) }} aria-invalid={!!fieldErrors.token} />
              <p className="text-xs text-text-secondary">
                Gere em{" "}
                <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-brand-primary underline">
                  id.atlassian.com
                </a>
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => setOpen(false)} disabled={saving} />
            <Button
              className="gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Loader2 className="size-4 shrink-0 animate-spin" />Salvando…</>
                : <><Check className="size-4 shrink-0" />Salvar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
