"use client"

import * as React from "react"
import { Gift, Loader2, X, Check } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CHAPTER_PRIZES } from "@/features/equipe/lib/chapter-prizes"
import { redeemChapterPrize, getMyChapterBalance } from "@/features/equipe/actions/equipe-chapters"

interface PremiosModalProps {
  open: boolean
  onClose: () => void
  /** Saldo inicial vindo do ranking — atualizado ao abrir */
  initialPoints: number
  onRedeemed: () => void
}

export function PremiosModal({ open, onClose, initialPoints, onRedeemed }: PremiosModalProps) {
  const [points, setPoints] = React.useState(initialPoints)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [loadingBalance, setLoadingBalance] = React.useState(false)

  // Recarrega saldo real ao abrir (pode ter mudado desde o ranking)
  React.useEffect(() => {
    if (!open) { setSelectedId(null); return }
    setPoints(initialPoints)
    setLoadingBalance(true)
    getMyChapterBalance()
      .then((b) => setPoints(b.points))
      .catch(() => {})
      .finally(() => setLoadingBalance(false))
  }, [open, initialPoints])

  async function handleRedeem() {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await redeemChapterPrize(selectedId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Prêmio solicitado com sucesso! O gestor foi notificado.")
      setPoints(res.newPoints)
      setSelectedId(null)
      onRedeemed()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const selected = CHAPTER_PRIZES.find((p) => p.id === selectedId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-4 shrink-0 text-brand-primary" aria-hidden />
            Prêmios
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Saldo */}
          <div className="flex items-center gap-2 rounded-lg border border-border-default bg-neutral-grey-50 px-4 py-3">
            <span className="text-sm text-text-secondary">Seu saldo:</span>
            {loadingBalance ? (
              <Loader2 className="size-4 animate-spin text-text-secondary" />
            ) : (
              <span className="text-sm font-bold tabular-nums text-brand-primary">
                {points} pts
              </span>
            )}
          </div>

          {/* Tabela de prêmios */}
          <div className="overflow-hidden rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-neutral-grey-50">
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-text-secondary">
                    Custo
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-text-secondary">
                    Descrição
                  </th>
                </tr>
              </thead>
              <tbody>
                {CHAPTER_PRIZES.map((prize) => {
                  const affordable = points >= prize.costPoints
                  const isSelected = selectedId === prize.id
                  return (
                    <tr
                      key={prize.id}
                      className={`border-b border-border-default last:border-b-0 transition-colors ${affordable ? "cursor-pointer hover:bg-neutral-grey-50" : "opacity-40"}`}
                      onClick={() => affordable && setSelectedId(isSelected ? null : prize.id)}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name="premio"
                          value={prize.id}
                          checked={isSelected}
                          disabled={!affordable}
                          onChange={() => setSelectedId(prize.id)}
                          className="accent-brand-primary"
                          aria-label={prize.label}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-text-primary">
                        {prize.costPoints} pts
                      </td>
                      <td className="px-3 py-3 text-text-primary">
                        {prize.label}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selected && (
            <p className="text-sm text-text-secondary">
              Após resgatar, seu saldo passará de{" "}
              <span className="font-semibold">{points} pts</span> para{" "}
              <span className="font-semibold">{points - selected.costPoints} pts</span>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={onClose}
            disabled={saving}
          >
            <X className="size-4 shrink-0" aria-hidden />
            Cancelar
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            onClick={() => void handleRedeem()}
            disabled={!selectedId || saving}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Resgatando…
              </>
            ) : (
              <>
                <Check className="size-4 shrink-0" aria-hidden />
                Resgatar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
