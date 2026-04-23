"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { ChapterAuthorsPicklist } from "@/components/equipe/ChapterAuthorsPicklist"
import {
  createEquipeChapter,
  updateEquipeChapter,
  type EquipeChapterAuthorOption,
} from "@/lib/actions/equipe-chapters"
import { formatChapterDateLabelPt, listThursdayYmOptions } from "@/lib/equipe-chapter-dates"

export type ChapterScheduleInitial = {
  id: string
  tema: string
  dataYmd: string
  authorIds: string[]
  hyperlink: string | null
}

export interface ChapterScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial: ChapterScheduleInitial | null
  authorOptions: EquipeChapterAuthorOption[]
  onSuccess: () => void
}

export function ChapterScheduleDialog({
  open,
  onOpenChange,
  mode,
  initial,
  authorOptions,
  onSuccess,
}: ChapterScheduleDialogProps) {
  const [isPending, startTransition] = React.useTransition()
  const [tema, setTema] = React.useState("")
  const [authorIds, setAuthorIds] = React.useState<string[]>([])
  const [dataYmd, setDataYmd] = React.useState("")
  const [hyperlink, setHyperlink] = React.useState("")

  const dateOptions = React.useMemo(() => {
    const inc = mode === "edit" && initial ? initial.dataYmd : null
    return listThursdayYmOptions(new Date(), { maxCount: 52, includeYmd: inc })
  }, [mode, initial?.dataYmd])

  React.useEffect(() => {
    if (!open) return
    if (mode === "edit" && initial) {
      setTema(initial.tema)
      setAuthorIds([...initial.authorIds])
      setDataYmd(initial.dataYmd)
      setHyperlink(initial.hyperlink ?? "")
    } else {
      setTema("")
      setAuthorIds([])
      setHyperlink("")
      const opts = listThursdayYmOptions(new Date(), { maxCount: 52 })
      setDataYmd(opts[0] ?? "")
    }
  }, [open, mode, initial])

  function handleSubmit() {
    if (!tema.trim()) {
      toast.error("O tema é obrigatório.")
      return
    }
    if (authorIds.length === 0) {
      toast.error("Selecione pelo menos um autor.")
      return
    }
    if (!dataYmd) {
      toast.error("Selecione a data (quinta-feira).")
      return
    }

    startTransition(async () => {
      if (mode === "create") {
        const res = await createEquipeChapter({
          tema: tema.trim(),
          dataYmd,
          authorIds,
          hyperlink: hyperlink.trim() || undefined,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success("Chapter agendado.")
        onOpenChange(false)
        onSuccess()
        return
      }

      if (!initial?.id) {
        toast.error("Chapter inválido.")
        return
      }
      const res = await updateEquipeChapter({
        id: initial.id,
        tema: tema.trim(),
        dataYmd,
        authorIds,
        hyperlink: hyperlink.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Chapter atualizado.")
      onOpenChange(false)
      onSuccess()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Agendar Chapter" : "Editar Chapter"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="space-y-1.5">
            <label htmlFor="chapter-tema" className="text-sm font-medium text-text-primary">
              Tema <span className="text-destructive">*</span>
            </label>
            <Input
              id="chapter-tema"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              maxLength={240}
              disabled={isPending}
              placeholder="Ex.: Boas práticas de API"
            />
            <p className="text-xs text-text-secondary">{tema.length}/240</p>
          </div>

          <ChapterAuthorsPicklist
            idPrefix="chapter-schedule"
            options={authorOptions}
            value={authorIds}
            onChange={setAuthorIds}
            disabled={isPending}
          />

          <div className="space-y-1.5">
            <label htmlFor="chapter-data" className="text-sm font-medium text-text-primary">
              Data (quinta-feira) <span className="text-destructive">*</span>
            </label>
            <Select value={dataYmd} onValueChange={(v) => setDataYmd(v ?? "")} disabled={isPending}>
              <SelectTrigger id="chapter-data" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {dateOptions.map((ymd) => (
                  <SelectItem key={ymd} value={ymd}>
                    {formatChapterDateLabelPt(ymd)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <p className="text-xs text-text-secondary">Somente quintas-feiras, a partir de hoje (fuso São Paulo).</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="chapter-link" className="text-sm font-medium text-text-primary">
              Hyperlink <span className="text-xs font-normal text-text-secondary">(opcional)</span>
            </label>
            <Input
              id="chapter-link"
              type="text"
              inputMode="url"
              value={hyperlink}
              onChange={(e) => setHyperlink(e.target.value)}
              disabled={isPending}
              placeholder="https://…"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter showCloseButton={false} className="gap-2 sm:justify-end">
          <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
            Cancelar
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
