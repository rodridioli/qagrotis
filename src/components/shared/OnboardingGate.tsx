"use client"

import { useState } from "react"
import { AlertTriangle, Check, Loader2, LogOut, PlugZap, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Props {
  hasJiraConfigured: boolean
  hasClockworkConfigured: boolean
  isMgr: boolean
  defaultEmail?: string
}

export function OnboardingGate({
  hasJiraConfigured: initialJira,
  hasClockworkConfigured: initialClockwork,
  isMgr,
  defaultEmail = "",
}: Props) {
  const router = useRouter()

  const [jiraConfigured, setJiraConfigured] = useState(initialJira)
  const [clockworkConfigured, setClockworkConfigured] = useState(initialClockwork)

  const step = !jiraConfigured ? "jira" : isMgr && !clockworkConfigured ? "clockwork" : "done"

  if (step === "done") return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-gate-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface-card shadow-xl">
        {step === "jira" ? (
          <JiraStep
            defaultEmail={defaultEmail}
            onConfigured={() => {
              setJiraConfigured(true)
              router.refresh()
            }}
          />
        ) : (
          <ClockworkStep
            onConfigured={() => {
              setClockworkConfigured(true)
              router.refresh()
            }}
          />
        )}
      </div>
    </div>
  )
}

// ── Jira ─────────────────────────────────────────────────────────────────────

interface JiraStepProps {
  defaultEmail: string
  onConfigured: () => void
}

function JiraStep({ defaultEmail, onConfigured }: JiraStepProps) {
  const [jiraUrl, setJiraUrl] = useState("https://agrotis.atlassian.net/")
  const [email, setEmail] = useState(defaultEmail)
  const [token, setToken] = useState("")
  const [accountEmail, setAccountEmail] = useState(defaultEmail)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ jiraUrl?: boolean; email?: boolean; token?: boolean }>({})

  const emailDiverges =
    !!accountEmail && !!email.trim() && email.trim().toLowerCase() !== accountEmail.toLowerCase()

  async function load() {
    if (loaded) return
    try {
      const r = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (r.ok) {
        const d = (await r.json()) as { jiraUrl?: string; jiraEmail?: string; accountEmail?: string }
        const ae = d.accountEmail?.trim() ?? defaultEmail
        setAccountEmail(ae)
        setJiraUrl(d.jiraUrl?.trim() || "https://agrotis.atlassian.net/")
        setEmail(d.jiraEmail?.trim() || ae)
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }

  // Load on first render
  if (!loaded) { void load() }

  async function handleSave() {
    const e: typeof fieldErrors = {}
    if (!jiraUrl.trim()) e.jiraUrl = true
    if (!email.trim()) e.email = true
    if (!token.trim()) e.token = true
    if (Object.keys(e).length > 0) {
      setFieldErrors(e)
      setError("Preencha todos os campos obrigatórios.")
      return
    }
    setFieldErrors({})
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/jira/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUrl: jiraUrl.trim(), jiraEmail: email.trim(), jiraToken: token.trim() }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "Erro ao salvar credenciais.")
      }
      try {
        ;["jira_url", "jira_email", "jira_token", "jira_cookie_ok"].forEach((k) => localStorage.removeItem(k))
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("jira-credentials-synced"))
      onConfigured()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível conectar ao Jira. Verifique a URL.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-badge-warning/10">
          <PlugZap className="size-7 text-badge-warning-text" aria-hidden />
        </span>
        <div>
          <h2 id="onboarding-gate-title" className="text-lg font-semibold text-text-primary">
            Configure sua integração com o Jira
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Sincronize seus dados e registros de trabalho.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="og-jira-url" className="text-sm font-medium text-text-primary">
            URL do Jira <span className="text-destructive">*</span>
          </label>
          <Input
            id="og-jira-url"
            placeholder="https://empresa.atlassian.net"
            value={jiraUrl}
            onChange={(e) => { setJiraUrl(e.target.value); setFieldErrors((p) => ({ ...p, jiraUrl: false })) }}
            aria-invalid={!!fieldErrors.jiraUrl}
            aria-required="true"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="og-jira-email" className="text-sm font-medium text-text-primary">
            E-mail da conta Jira <span className="text-destructive">*</span>
          </label>
          <Input
            id="og-jira-email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: false })) }}
            aria-invalid={!!fieldErrors.email}
            aria-required="true"
          />
          {emailDiverges && (
            <p className="flex items-start gap-1.5 text-xs text-badge-warning-text" role="alert">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              E-mail diferente do seu acesso ({accountEmail}). Confirme que é a conta Atlassian correta.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="og-jira-token" className="text-sm font-medium text-text-primary">
            API Token <span className="text-destructive">*</span>
          </label>
          <Input
            id="og-jira-token"
            type="password"
            placeholder="••••••••••••••••••••"
            value={token}
            onChange={(e) => { setToken(e.target.value); setFieldErrors((p) => ({ ...p, token: false })) }}
            aria-invalid={!!fieldErrors.token}
            aria-required="true"
          />
          <p className="text-xs text-text-secondary">
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary underline"
            >
              Como gerar um token Jira?
            </a>
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button className="w-full gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? (
          <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Verificando conexão…</>
        ) : (
          <><Check className="size-4 shrink-0" aria-hidden />Validar e continuar</>
        )}
      </Button>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-destructive"
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        Sair do sistema
      </button>
    </div>
  )
}

// ── Clockwork ─────────────────────────────────────────────────────────────────

interface ClockworkStepProps {
  onConfigured: () => void
}

function ClockworkStep({ onConfigured }: ClockworkStepProps) {
  const [token, setToken] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState(false)

  async function handleSave() {
    if (!token.trim()) {
      setFieldError(true)
      setError("Informe o API Token do Clockwork.")
      return
    }
    setFieldError(false)
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/clockwork/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ apiToken: token.trim() }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(j?.error || "Erro ao salvar token Clockwork.")
      }
      onConfigured()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-badge-warning/10">
          <Timer className="size-7 text-badge-warning-text" aria-hidden />
        </span>
        <div>
          <h2 id="onboarding-gate-title" className="text-lg font-semibold text-text-primary">
            Configure o Clockwork
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Como administrador, você também precisa configurar o Clockwork para gerenciar os registros da equipe.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label htmlFor="og-cw-token" className="text-sm font-medium text-text-primary">
            API Token <span className="text-destructive">*</span>
          </label>
          <Input
            id="og-cw-token"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••••••••••"
            value={token}
            onChange={(e) => { setToken(e.target.value); setFieldError(false) }}
            aria-invalid={fieldError}
            aria-required="true"
          />
          <p className="text-xs text-text-secondary">
            <a
              href="https://docs.herocoders.com/clockwork/use-the-clockwork-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary underline"
            >
              Como gerar um token Clockwork?
            </a>
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <Button className="w-full gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? (
          <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />Salvando…</>
        ) : (
          <><Check className="size-4 shrink-0" aria-hidden />Salvar e entrar no sistema</>
        )}
      </Button>
    </div>
  )
}
