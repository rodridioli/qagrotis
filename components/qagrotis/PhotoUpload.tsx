"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import { CloudUpload, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PhotoCropModal } from "./PhotoCropModal"
import { cn } from "@/lib/utils"

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
        <div className="relative mx-auto size-48 shrink-0 overflow-hidden rounded-full border border-border-default shadow-sm">
          <Image
            src={preview}
            alt="Foto de perfil"
            fill
            unoptimized
            className="object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover foto"
            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
          >
            <Trash2 className="size-4 text-primary-foreground" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "mx-auto flex size-48 shrink-0 flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100",
          )}
        >
          <CloudUpload className="size-7" />
          <div className="px-2 text-center">
            <p className="text-xs font-medium">Upload</p>
            <p className="text-[10px] leading-tight">JPG ou PNG · 400×400</p>
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
