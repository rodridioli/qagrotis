"use client"

import { useState } from "react"
import { AlertTriangle, Check, Loader2, PanelsTopLeft, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CancelActionButton } from "@/components/shared/CancelActionButton"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface JiraInstance {
  jiraUrl: string
  jiraEmail: string
  hasToken: boolean
}

interface Props {
  defaultEmail?: string
}

export default function JiraConfigButton({ defaultEmail = "" }: Props) {
  // ── Lista de instâncias ────────────────────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [instances, setInstances] = useState<JiraInstance[]>([])
  const [loadingInstances, setLoadingInstances] = useState(false)

  // ── Formulário de adição/edição ────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingUrl, setEditingUrl] = useState<string | null>(null) // null = nova instância
  const [jiraUrl, setJiraUrl] = useState("")
  const [email, setEmail] = useState(defaultEmail)
  const [token, setToken] = useState("")
  const [hasStoredToken, setHasStoredToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ jiraUrl?: boolean; email?: boolean; token?: boolean }>({})
  const [accountEmail, setAccountEmail] = useState("")

  // ── Remover instância ──────────────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const emailDiverges =
    !!accountEmail &&
    !!email.trim() &&
    email.trim().toLowerCase() !== accountEmail.toLowerCase()

  // ── Abre a listagem ────────────────────────────────────────────────────────
  async function handleOpen() {
    setOpen(true)
    setLoadingInstances(true)
    try {
      const r = await fetch("/api/jira/credentials", { credentials: "same-origin" })
      if (r.ok) {
        const d = (await r.json()) as { instances?: JiraInstance[]; accountEmail?: string }
        setInstances(d.instances ?? [])
        setAccountEmail(d.accountEmail?.trim() ?? defaultEmail)
      }
    } catch {
      /* silent */
    } finally {
      setLoadingInstances(false)
    }
  }

  // ── Abre form para nova instância ──────────────────────────────────────────
  function handleAddNew() {
    setEditingUrl(null)
    setJiraUrl("")
    setEmail(accountEmail || defaultEmail)
    setToken("")
    setHasStoredToken(false)
    setFieldErrors({})
    setFormOpen(true)
  }

  // ── Abre form para editar instância existente ──────────────────────────────
  function handleEdit(inst: JiraInstance) {
    setEditingUrl(inst.jiraUrl)
    setJiraUrl(inst.jiraUrl)
    setEmail(inst.jiraEmail)
    setToken("")
    setHasStoredToken(inst.hasToken)
    setFieldErrors({})
    setFormOpen(true)
  }

  // ── Salva (cria ou edita) ──────────────────────────────────────────────────
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
      const saveRes = await fetch("/api/jira/credentials", {
        method: "POST",
        credentials: "same-origin",
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
      } catch { /* ignore */ }

      // Actualiza a lista local
      const newInst: JiraInstance = { jiraUrl: jiraUrl.trim(), jiraEmail: email.trim(), hasToken: true }
      setInstances((prev) => {
        const without = prev.filter((i) => i.jiraUrl !== newInst.jiraUrl)
        return editingUrl ? prev.map((i) => i.jiraUrl === editingUrl ? newInst : i) : [...without, newInst]
      })

      window.dispatchEvent(new Event("jira-credentials-synced"))
      toast.success(editingUrl ? "Instância Jira actualizada." : "Instância Jira adicionada.")
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar ao Jira. Verifique a URL.")
    } finally {
      setSaving(false)
    }
  }

  // ── Remove instância ───────────────────────────────────────────────────────
  async function handleConfirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await fetch("/api/jira/credentials", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraUrl: removeTarget }),
      })
      if (!res.ok) throw new Error("Erro ao remover.")
      setInstances((prev) => prev.filter((i) => i.jiraUrl !== removeTarget))
      toast.success("Instância Jira removida.")
    } catch {
      toast.error("Não foi possível remover a instância.")
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  return (
    <>
      {/* ── Card de entrada ── */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50 w-full"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
          <PanelsTopLeft className="size-6" />
        </div>
        <span className="font-semibold text-text-primary">Jira</span>
      </button>

      {/* ── Dialog: lista de instâncias ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Jira — Instâncias configuradas</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <p className="text-sm text-text-secondary">
              Cada instância Atlassian (ex: <span className="font-medium text-text-primary">agrotis.atlassian.net</span>) requer
              um URL, e-mail e API Token próprios. Um MGR com múltiplas instâncias configuradas
              pode editar worklogs de qualquer projecto.
            </p>

            {loadingInstances ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-text-secondary" />
              </div>
            ) : instances.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-default py-6 text-center text-sm text-text-secondary">
                Nenhuma instância configurada.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {instances.map((inst) => (
                  <li
                    key={inst.jiraUrl}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-default px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{inst.jiraUrl}</p>
                      <p className="truncate text-xs text-text-secondary">{inst.jiraEmail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(inst)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-brand-primary transition-colors hover:bg-neutral-grey-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        aria-label="Remover instância"
                        onClick={() => setRemoveTarget(inst.jiraUrl)}
                        className="flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <CancelActionButton onClick={() => setOpen(false)} />
            <Button className="gap-1.5" onClick={handleAddNew}>
              <Plus className="size-4 shrink-0" />
              Adicionar instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: formulário de instância ── */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUrl ? "Editar instância Jira" : "Nova instância Jira"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                URL do Jira <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="https://empresa.atlassian.net"
                value={jiraUrl}
                disabled={!!editingUrl} // URL não editável — é a chave da instância
                onChange={(e) => { setJiraUrl(e.target.value); setFieldErrors((p) => ({ ...p, jiraUrl: false })) }}
                aria-invalid={!!fieldErrors.jiraUrl}
              />
              {editingUrl && (
                <p className="text-xs text-text-secondary">Para alterar a URL, remova e recadastre a instância.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                E-mail da conta Jira <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: false })) }}
                aria-invalid={!!fieldErrors.email}
              />
              {emailDiverges && (
                <p className="flex items-start gap-1.5 text-xs text-badge-warning-text" role="alert">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  E-mail diferente do seu acesso ({accountEmail}). Confirme que é a conta Atlassian correta.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                API Token {!hasStoredToken && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="password"
                placeholder={hasStoredToken ? "Deixe em branco para manter o token actual" : "••••••••••••••••••••"}
                value={token}
                onChange={(e) => { setToken(e.target.value); setFieldErrors((p) => ({ ...p, token: false })) }}
                aria-invalid={!!fieldErrors.token}
              />
              <p className="text-xs text-text-secondary">
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary underline"
                >
                  Gerar API Token no Atlassian
                </a>
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <CancelActionButton onClick={() => setFormOpen(false)} disabled={saving} />
            <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Loader2 className="size-4 shrink-0 animate-spin" />Salvando…</>
                : <><Check className="size-4 shrink-0" />Salvar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm remover instância ── */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(v) => { if (!v && !removing) setRemoveTarget(null) }}
        title="Remover instância Jira?"
        description={removeTarget ? `As credenciais de ${removeTarget} serão removidas permanentemente.` : ""}
        confirmLabel={removing ? "Removendo…" : "Remover"}
        confirmIcon={removing
          ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          : <Trash2 className="size-4 shrink-0" aria-hidden />
        }
        disabled={removing}
        onConfirm={handleConfirmRemove}
      />
    </>
  )
}
