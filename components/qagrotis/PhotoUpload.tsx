"use client"

import React, { useRef } from "react"
import { CloudUpload, Trash2 } from "lucide-react"

interface PhotoUploadProps {
  preview: string | null
  onFileSelect: (file: File) => void
  onRemove: () => void
}

export function PhotoUpload({ preview, onFileSelect, onRemove }: PhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onFileSelect(file)
    // Reset input so the same file can be re-selected
    e.target.value = ""
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Foto de perfil"
            className="h-48 w-full rounded-custom object-cover"
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
            <p className="text-xs">PNG, JPG até 5MB</p>
          </div>
        </button>
      )}
    </>
  )
}
