"use client"

import { useRef } from "react"
import { Paperclip, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EVIDENCE_FILE_ACCEPT, isAllowedEvidenceFile } from "@/lib/evidence-file-types"

export interface UploadFile {
  name: string
  type: string
  dataUrl: string
}

function isImageOrPdfFile(f: Pick<File, "name" | "type">): boolean {
  const t = (f.type || "").toLowerCase()
  if (t.startsWith("image/")) return true
  if (t === "application/pdf") return true
  return f.name.toLowerCase().endsWith(".pdf")
}

interface FileUploadButtonProps {
  files: UploadFile[]
  onChangeFiles: (files: UploadFile[]) => void
  accept?: string
  label?: string
  className?: string
  /** Quando true (ex.: Gerador), aceita só imagem e PDF — não vídeo. */
  imageAndPdfOnly?: boolean
}

export function FileUploadButton({
  files,
  onChangeFiles,
  accept = EVIDENCE_FILE_ACCEPT,
  label = "Anexar arquivo",
  className,
  imageAndPdfOnly = false,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const allowed = Array.from(fileList).filter((f) =>
      imageAndPdfOnly ? isImageOrPdfFile(f) : isAllowedEvidenceFile(f),
    )
    if (allowed.length === 0) {
      toast.error(
        imageAndPdfOnly
          ? "Selecione arquivos de imagem (PNG, JPG, etc.) ou PDF."
          : "Selecione imagens, PDF ou vídeos (MP4, WebM, MOV, etc.).",
      )
      return
    }
    const results = await Promise.all(
      allowed.map(
        (file) =>
          new Promise<UploadFile>((resolve) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({ name: file.name, type: file.type, dataUrl: reader.result as string })
            reader.readAsDataURL(file)
          })
      )
    )
    onChangeFiles([...files, ...results])
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="size-4" />
          {label}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-neutral-grey-50 px-2.5 py-1 text-xs text-text-primary"
            >
              <Paperclip className="size-3 shrink-0 text-text-secondary" />
              <span className="max-w-40 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => onChangeFiles(files.filter((_, idx) => idx !== i))}
                aria-label={`Remover ${f.name}`}
                className="text-text-secondary transition-colors hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-text-secondary">Nenhum arquivo anexado.</p>
      )}
    </div>
  )
}
