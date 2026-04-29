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
        <div className="relative h-48 w-full">
          <Image
            src={preview}
            alt="Foto de perfil"
            fill
            unoptimized
            className="rounded-custom object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover foto"
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90"
          >
            <Trash2 className="size-4 text-primary-foreground" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-custom border-2 border-dashed border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
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
