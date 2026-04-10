"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Eye, EyeOff, RefreshCw } from "lucide-react"
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
import { criarQaUser, atualizarQaUser } from "@/lib/actions/usuarios"
import { toast } from "sonner"

function generateSecurePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digits = "23456789"
  const special = "!@#$%&*"
  const all = upper + lower + digits + special
  const arr = new Uint8Array(12)
  crypto.getRandomValues(arr)
  const chars = [
    upper[arr[0] % upper.length],
    upper[arr[1] % upper.length],
    lower[arr[2] % lower.length],
    lower[arr[3] % lower.length],
    digits[arr[4] % digits.length],
    digits[arr[5] % digits.length],
    special[arr[6] % special.length],
    special[arr[7] % special.length],
    all[arr[8] % all.length],
    all[arr[9] % all.length],
    all[arr[10] % all.length],
    all[arr[11] % all.length],
  ]
  const shuffleArr = new Uint8Array(chars.length)
  crypto.getRandomValues(shuffleArr)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

export default function NovoUsuarioForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [tipo, setTipo] = useState<string>("Padrão")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [initialPassword] = useState(() => generateSecurePassword())
  const [password, setPassword] = useState(initialPassword)
  const [confirmPassword, setConfirmPassword] = useState(initialPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleGeneratePassword() {
    const pwd = generateSecurePassword()
    setPassword(pwd)
    setConfirmPassword(pwd)
  }

  function handlePhotoSelect(file: File) {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Formato de e-mail inválido.")
      return
    }
    if (password.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    startTransition(async () => {
      let photoPath: string | null = null

      // 1. Create user first to get ID
      const result = await criarQaUser({ name: nome, email, type: tipo, password })
      if (result.error || !result.id) {
        toast.error(result.error ?? "Erro ao criar usuário.")
        return
      }

      const newId = result.id

      // 2. Upload photo if selected
      if (photoFile) {
        const fd = new FormData()
        fd.set("photo", photoFile)
        const res = await fetch(`/api/usuarios/${newId}/avatar`, {
          method: "PUT",
          body: fd,
        })
        if (res.ok) {
          const json = await res.json() as { photoPath: string }
          photoPath = json.photoPath
          
          // 3. Update user with the photo path
          await atualizarQaUser(newId, {
            name: nome,
            email,
            type: tipo,
            photoPath,
          })
        } else {
          const errorJson = await res.json().catch(() => ({})) as { error?: string }
          toast.warning(`Usuário criado, mas houve erro na foto: ${errorJson.error ?? "Erro desconhecido"}`)
        }
      }

      if (result.emailEnviado) {
        toast.success("Usuário criado. E-mail com senha enviado.")
      } else {
        toast.success("Usuário criado. O e-mail com senha não pôde ser enviado — informe-o manualmente.")
      }
      router.push("/configuracoes/usuarios")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes/usuarios"
            title="Voltar"
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
        <div className="space-y-4 rounded-xl bg-surface-card p-5 shadow-card lg:col-span-2">
          <div className="space-y-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-text-primary">
              Nome <span className="text-destructive">*</span>
            </label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text-primary">
              E-mail <span className="text-destructive">*</span>
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tipo" className="text-sm font-medium text-text-primary">
              Tipo <span className="text-destructive">*</span>
            </label>
            <Select value={tipo} onValueChange={(v) => setTipo(v ?? "Padrão")} disabled={isPending}>
              <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
              <SelectPopup>
                <SelectItem value="Padrão">Padrão</SelectItem>
                <SelectItem value="Administrador">Administrador</SelectItem>
              </SelectPopup>
            </Select>
          </div>

          {/* ── Password section ── */}
          <div className="border-t border-border-default pt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">
                Senha de acesso <span className="text-destructive">*</span>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGeneratePassword}
                disabled={isPending}
              >
                <RefreshCw className="size-3.5" />
                Gerar senha segura
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-text-primary">Senha</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">Confirmar senha</label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Ocultar confirmação de senha" : "Exibir confirmação de senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              O usuário receberá um e-mail com a senha e deverá alterá-la no primeiro acesso.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-card p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-text-primary">Foto de Perfil</h2>
          <PhotoUpload
            preview={photoPreview}
            onFileSelect={handlePhotoSelect}
            onRemove={() => { setPhotoFile(null); setPhotoPreview(null) }}
          />
        </div>
      </div>
    </div>
  )
}
