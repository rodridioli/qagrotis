"use client"

import { useState } from "react"
import { Check, Loader2, Timer } from "lucide-react"
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

export default function ClockworkConfigButton() {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")
  const [hasStoredToken, setHasStoredToken] = useState(false)
  const [hasEnvFallback, setHasEnvFallback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ token?: boolean }>({})

  async function handleOpen() {
    setToken("")
    setFieldErrors({})
    try {
      const r = await fetch("/api/clockwork/credentials", { credentials: "same-origin" })
      if (r.ok) {
        const d = (await r.json()) as { hasToken?: boolean; hasEnvFallback?: boolean }
        setHasStoredToken(!!d.hasToken)
        setHasEnvFallback(!!d.hasEnvFallback)
      } else {
        setHasStoredToken(false)
        setHasEnvFallback(false)
      }
    } catch {
      setHasStoredToken(false)
      setHasEnvFallback(false)
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!token.trim() && !hasStoredToken) {
      setFieldErrors({ token: true })
      toast.error("Informe o API Token.")
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      const saveRes = await fetch("/api/clockwork/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(token.trim() ? { apiToken: token.trim() } : {}),
      })
      if (!saveRes.ok) {
        const j = (await saveRes.json().catch(() => null)) as { error?: string } | null
        throw new Error(j?.error || (await saveRes.text().catch(() => "")) || "Erro ao salvar.")
      }
      setHasStoredToken(true)
      setToken("")
      toast.success("API Clockwork salva com sucesso.")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
          <Timer className="size-6" />
        </div>
        <span className="font-semibold text-text-primary">API Clockwork</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Clockwork</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-text-secondary">
              Token da API Clockwork Pro (instância única da aplicação). O valor é guardado de forma cifrada na base
              de dados. Apenas administradores com perfil MGR podem alterar esta configuração. O token não é exibido
              depois de salvo; para trocá-lo, informe um novo API Token.
            </p>
            {hasEnvFallback ? (
              <p className="text-xs text-text-secondary">
                Existe também <strong className="font-medium text-text-primary">CLOCKWORK_API_TOKEN</strong> no ambiente
                do servidor — usado como reserva se não houver token na base de dados.
              </p>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                API Token {!hasStoredToken && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={hasStoredToken ? "Deixe em branco para manter o token atual" : ""}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value)
                  setFieldErrors((p) => ({ ...p, token: false }))
                }}
                aria-invalid={!!fieldErrors.token}
              />
              <p className="text-xs text-text-secondary">
                <a
                  href="https://docs.herocoders.com/clockwork/use-the-clockwork-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline"
                >
                  Gerar API: Clockwork
                </a>
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => setOpen(false)} disabled={saving} />
            <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                <>
                  <Check className="size-4 shrink-0" aria-hidden />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
