"use client"

import { useState } from "react"
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

  function handleOpen() {
    setJiraUrl(localStorage.getItem("jira_url") || "https://agrotis.atlassian.net/")
    setEmail(localStorage.getItem("jira_email") || defaultEmail)
    setToken(localStorage.getItem("jira_token") || "")
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
          <svg viewBox="0 0 32 32" fill="currentColor" className="size-6" aria-hidden="true">
            <path d="M15.947 0C12.024.013 8.32 1.518 5.558 4.25L.44 9.345a1.498 1.498 0 000 2.122l5.118 5.094a1.507 1.507 0 002.127 0l4.647-4.624a3.01 3.01 0 014.254 0l4.647 4.624a1.507 1.507 0 002.127 0l5.118-5.094a1.498 1.498 0 000-2.122L23.09 4.098C20.38 1.42 16.76-.012 15.947 0zm.053 11.377l-4.647 4.624a1.507 1.507 0 000 2.122l4.647 4.624a1.507 1.507 0 002.127 0l4.647-4.624a1.507 1.507 0 000-2.122l-4.647-4.624a1.507 1.507 0 00-2.127 0z"/>
          </svg>
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
              Configure as credenciais para exportar históricos diretamente para o Jira. As informações são salvas localmente no seu navegador.
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
