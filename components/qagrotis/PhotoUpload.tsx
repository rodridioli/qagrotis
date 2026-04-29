"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import { CloudUpload, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PhotoCropModal } from "./PhotoCropModal"

interface PhotoUploadProps {
  preview: string | null
  onFileSelect: (file: File) => void
  onRemove: () => void
}

const TARGET_SIZE = 400
const ACCEPTED_MIMES = ["image/jpeg", "image/png"]

export function PhotoUpload({ preview, onFileSelect, onRemove }: PhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!ACCEPTED_MIMES.includes(file.type)) {
      toast.error("Use uma imagem JPG ou PNG.")
      return
    }
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.naturalWidth === TARGET_SIZE && img.naturalHeight === TARGET_SIZE) {
        onFileSelect(file)
      } else {
        setCropFile(file)
        setCropOpen(true)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error("Não foi possível ler a imagem.")
    }
    img.src = url
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="relative w-full max-w-xs shrink-0">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border-default bg-neutral-grey-50 shadow-sm">
            <Image
              src={preview}
              alt="Foto de perfil"
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 320px"
            />
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover foto"
            className="absolute -right-1 -top-1 z-20 flex size-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Trash2 className="size-5 shrink-0" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square w-full max-w-xs flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
        >
          <CloudUpload className="size-8" />
          <div className="text-center">
            <p className="text-sm font-medium">Upload de imagem</p>
            <p className="text-xs">JPG ou PNG · 400×400 px</p>
          </div>
        </button>
      )}

      <PhotoCropModal
        file={cropFile}
        open={cropOpen}
        onOpenChange={(o) => { setCropOpen(o); if (!o) setCropFile(null) }}
        onConfirm={(cropped) => onFileSelect(cropped)}
      />
    </>
  )
}
