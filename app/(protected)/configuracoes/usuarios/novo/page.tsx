"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { PhotoUpload } from "@/components/qagrotis/PhotoUpload"
import { criarQaUser } from "@/lib/actions/usuarios"
import { toast } from "sonner"

export default function NovoUsuarioPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [tipo, setTipo] = useState<string>("Padrão")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function handlePhotoSelect(file: File) {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handlePhotoRemove() {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  function handleSave() {
    if (!nome.trim()) {
      toast.error("O nome é obrigatório.")
      return
    }
    if (!email.trim()) {
      toast.error("O e-mail é obrigatório.")
      return
    }
    if (!password) {
      toast.error("A senha é obrigatória.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    startTransition(async () => {
      await criarQaUser({ name: nome, email, type: tipo, password })
      toast.success("Usuário criado com sucesso.")
      router.push("/configuracoes/usuarios")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes/usuarios"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href="/configuracoes/usuarios" className="text-text-secondary hover:text-brand-primary">
            Usuários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Novo Usuário</span>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-4 lg:col-span-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Nome <span className="text-destructive">*</span>
            </label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              E-mail <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Tipo <span className="text-destructive">*</span>
            </label>
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "Padrão")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="Padrão">Padrão</SelectItem>
                <SelectItem value="Administrador">Administrador</SelectItem>
              </SelectPopup>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Senha <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-text-primary">Foto de Perfil</h2>
          <PhotoUpload
            preview={photoPreview}
            onFileSelect={handlePhotoSelect}
            onRemove={handlePhotoRemove}
          />
        </div>
      </div>
    </div>
  )
}
