"use client"

import React, { useState, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, CloudUpload, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function NovoUsuarioPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleSave() {
    toast.success("Usuário criado com sucesso.")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href="/configuracoes/usuarios" className="flex items-center gap-1 text-text-secondary hover:text-brand-primary">
            <ArrowLeft className="size-4" />
            Usuários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Novo Usuário</span>
        </div>
        <Button onClick={handleSave}>Salvar</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl bg-surface-card p-5 shadow-card space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Nome <span className="text-destructive">*</span>
            </label>
            <Input placeholder="Nome completo" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              E-mail <span className="text-destructive">*</span>
            </label>
            <Input type="email" placeholder="email@empresa.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Senha <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <span className="text-xs">{showPassword ? "Ocultar" : "Mostrar"}</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Confirmar senha <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  <span className="text-xs">{showConfirm ? "Ocultar" : "Mostrar"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-text-primary">Foto de Perfil</h2>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-48 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => { setImagePreview(null); if (fileRef.current) fileRef.current.value = "" }}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/90"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-default bg-surface-input text-text-secondary transition-colors hover:bg-neutral-grey-100"
            >
              <CloudUpload className="size-8 text-text-secondary" />
              <div className="text-center">
                <p className="text-sm font-medium">Upload de imagem</p>
                <p className="text-xs">PNG, JPG até 5MB</p>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={() => toast.info("Protótipo reiniciado.")}>
          Reiniciar Protótipo
        </Button>
      </div>
    </div>
  )
}
