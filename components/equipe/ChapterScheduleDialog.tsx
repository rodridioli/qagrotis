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
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChapterAuthorsMultiCombobox } from "@/components/equipe/ChapterAuthorsMultiCombobox"
import { createEquipeChapter, updateEquipeChapter } from "@/lib/actions/equipe-chapters"
import type {
  EquipeChapterAuthorDisplay,
  EquipeChapterAuthorOption,
} from "@/lib/equipe-chapters-shared"
import { isValidCalendarYmd, todayYmdBrazil } from "@/lib/equipe-chapter-dates"
import { inputNativePickerRightClassName } from "@/lib/input-native-picker-classes"

export type ChapterScheduleInitial = {
  id: string
  tema: string
  dataYmd: string
  authorIds: string[]
  hyperlink: string | null
  /** Autores persistidos (inclui inativos) — editar: rótulo e bloqueio do multi-select. */
  authors?: EquipeChapterAuthorDisplay[]
}

export interface ChapterScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  initial: ChapterScheduleInitial | null
  authorOptions: EquipeChapterAuthorOption[]
  onSuccess: () => void
}

function validateDateForSubmit(dataYmd: string): string | null {
  if (!dataYmd.trim()) return "Informe a data."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataYmd.trim())) return "Data inválida."
  const ymd = dataYmd.trim()
  if (!isValidCalendarYmd(ymd)) return "Data inválida."
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

  const authorOptionsReady = authorOptions.length > 0
  const lockAuthorsField = React.useMemo(() => {
    if (mode !== "edit" || !initial?.authorIds?.length || !authorOptionsReady) return false
    return initial.authorIds.some((id) => !authorOptions.some((o) => o.id === id))
  }, [mode, initial, authorOptions, authorOptionsReady])
  const authorsFieldDisabledUntilOptions = mode === "edit" && !authorOptionsReady

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
      setDataYmd(todayYmdBrazil())
    }
  }, [open, mode, initial])

  function onDateInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDataYmd(e.target.value)
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

    const dateErr = validateDateForSubmit(dataYmd)
    if (dateErr) {
      toast.error(dateErr)
      return
    }

    const ymd = dataYmd.trim()

    startTransition(() => {
      void (async () => {
        try {
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
        } catch (e) {
          console.error("[ChapterScheduleDialog] salvar", e)
          toast.error("Não foi possível salvar. Verifique a conexão e tente novamente.")
        }
      })()
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
            disabled={isPending || lockAuthorsField || authorsFieldDisabledUntilOptions}
            resolvedAuthors={mode === "edit" && initial?.authors?.length ? initial.authors : undefined}
          />
          {lockAuthorsField ? (
            <p className="text-xs text-text-secondary">
              Há autor inativo neste chapter. O nome é exibido para referência; altere autores após reativar o
              cadastro em Configurações.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="chapter-data" className="text-sm font-medium text-text-primary">
              Data do Evento <span className="text-destructive">*</span>
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
              Use o calendário ou digite a data (formato AAAA-MM-DD).
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
            <X className="size-4 shrink-0" />
            Cancelar
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            <Check className="size-4 shrink-0" />
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
