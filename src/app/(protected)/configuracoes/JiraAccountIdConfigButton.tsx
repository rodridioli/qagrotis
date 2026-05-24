"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, UserCog } from "lucide-react"
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
import { adminSetJiraAccountId } from "@/features/qa/actions/jira-worklog-cache"

export default function JiraAccountIdConfigButton() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [accountId, setAccountId] = useState("")
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; accountId?: boolean }>({})

  function handleOpen() {
    setEmail("")
    setAccountId("")
    setFieldErrors({})
    setOpen(true)
  }

  function handleSave() {
    const errors: typeof fieldErrors = {}
    if (!email.trim()) errors.email = true
    if (!accountId.trim()) errors.accountId = true
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    startTransition(async () => {
      try {
        const result = await adminSetJiraAccountId(email.trim(), accountId.trim())
        if (result.ok) {
          toast.success(`AccountId Jira registrado para ${result.name ?? email}. Faça um force sync no dashboard para carregar os dados.`)
          setOpen(false)
        } else {
          toast.error(result.error)
        }
      } catch (e) {
        toast.error("Erro ao salvar. Tente novamente.")
        console.error(e)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-col items-center gap-3 rounded-xl bg-surface-card p-8 shadow-card transition-colors hover:bg-neutral-grey-50"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
          <UserCog className="size-6" />
        </div>
        <span className="font-semibold text-text-primary">IDs Jira</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar AccountId Jira</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm text-text-secondary">
              Use para registrar manualmente o accountId Jira de ex-membros desativados que não aparecem no sync automático.
              O accountId está na URL do filtro Jira:{" "}
              <code className="rounded bg-neutral-grey-100 px-1 py-0.5 text-xs">worklogAuthor = 712020:XXXX-...</code>
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">E-mail do membro (no sistema)</label>
              <Input
                type="email"
                placeholder="carlos@agrotis.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, email: false }))
                }}
                className={fieldErrors.email ? "border-badge-error" : ""}
                disabled={isPending}
              />
              {fieldErrors.email && (
                <span className="text-xs text-badge-error">Campo obrigatório</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">AccountId Jira</label>
              <Input
                type="text"
                placeholder="712020:5b3955e4-541d-44fb-b61e-da3f9cd13bd8"
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, accountId: false }))
                }}
                className={fieldErrors.accountId ? "border-badge-error" : ""}
                disabled={isPending}
              />
              {fieldErrors.accountId && (
                <span className="text-xs text-badge-error">Campo obrigatório</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Salvando…</>
              ) : (
                <><Check className="mr-2 size-4" /> Salvar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
