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
import { ChapterAuthorsMultiCombobox } from "@/components/equipe/ChapterAuthorsMultiCombobox"
import {
  createEquipeChapter,
  updateEquipeChapter,
  type EquipeChapterAuthorOption,
} from "@/lib/actions/equipe-chapters"
import {
  isThursdayYmdBrazil,
  isValidUpdatedChapterDate,
  listThursdayYmOptions,
  todayYmdBrazil,
} from "@/lib/equipe-chapter-dates"
import { inputNativePickerRightClassName } from "@/lib/input-native-picker-classes"

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

const TOAST_NAO_QUINTA =
  "Só é possível agendar em quintas-feiras (fuso São Paulo)."

function validateDateForSubmit(
  mode: "create" | "edit",
  dataYmd: string,
  initial: ChapterScheduleInitial | null,
): string | null {
  if (!dataYmd.trim()) return "Informe a data."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataYmd.trim())) return "Data inválida."
  const ymd = dataYmd.trim()
  if (!isThursdayYmdBrazil(ymd)) return TOAST_NAO_QUINTA
  const today = todayYmdBrazil()
  if (mode === "create" && ymd < today) {
    return "Não é possível agendar em data retroativa."
  }
  if (mode === "edit" && initial) {
    if (!isValidUpdatedChapterDate(ymd, initial.dataYmd)) {
      return "A data deve ser quinta-feira; se alterar, não pode ser anterior a hoje."
    }
  }
  return null
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

  function onDateInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setDataYmd(v)
    if (v.length === 10 && isThursdayYmdBrazil(v) === false) {
      toast.error(TOAST_NAO_QUINTA)
    }
  }

  function handleSubmit() {
    if (!tema.trim()) {
      toast.error("O tema é obrigatório.")
      return
    }
    if (authorIds.length === 0) {
      toast.error("Selecione pelo menos um autor.")
      return
    }

    const dateErr = validateDateForSubmit(mode, dataYmd, initial)
    if (dateErr) {
      toast.error(dateErr)
      return
    }

    const ymd = dataYmd.trim()

    startTransition(async () => {
      if (mode === "create") {
        const res = await createEquipeChapter({
          tema: tema.trim(),
          dataYmd: ymd,
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
        dataYmd: ymd,
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
      <DialogContent showCloseButton className="overflow-visible sm:max-w-lg">
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

          <ChapterAuthorsMultiCombobox
            idPrefix="chapter-schedule"
            options={authorOptions}
            value={authorIds}
            onChange={setAuthorIds}
            disabled={isPending}
          />

          <div className="space-y-1.5">
            <label htmlFor="chapter-data" className="text-sm font-medium text-text-primary">
              Data (Qui.) <span className="text-destructive">*</span>
            </label>
            <Input
              id="chapter-data"
              type="date"
              value={dataYmd}
              onChange={onDateInputChange}
              disabled={isPending}
              className={inputNativePickerRightClassName()}
            />
            <p className="text-xs text-text-secondary">
              Use o calendário ou digite a data. Só quintas-feiras são aceitas (fuso São Paulo).
            </p>
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
