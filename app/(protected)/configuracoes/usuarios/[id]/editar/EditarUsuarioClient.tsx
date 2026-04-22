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
import { atualizarQaUser, type QaUserProfile } from "@/lib/actions/usuarios"
import { FORMATOS_TRABALHO, sanitizeFormatoTrabalho } from "@/lib/usuario-trabalho"
import { generateSecurePassword } from "@/lib/generate-secure-password"
import { inputNativePickerRightClassName } from "@/lib/input-native-picker-classes"
import { toast } from "sonner"

interface Props {
  id: string
  initialProfile: QaUserProfile
  isAdmin: boolean
}

export default function EditarUsuarioClient({ id, initialProfile, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState(initialProfile.name)
  const [email, setEmail] = useState(initialProfile.email)
  const [tipo, setTipo] = useState(initialProfile.type)
  const [cargo, setCargo] = useState<string>(initialProfile.classificacao ?? "")
  const [dataNascimento, setDataNascimento] = useState(initialProfile.dataNascimento ?? "")
  const [horarioEntrada, setHorarioEntrada] = useState(initialProfile.horarioEntrada ?? "")
  const [horarioSaida, setHorarioSaida] = useState(initialProfile.horarioSaida ?? "")
  const [formatoTrabalho, setFormatoTrabalho] = useState<string>(
    () => sanitizeFormatoTrabalho(initialProfile.formatoTrabalho) ?? "Presencial",
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initialProfile.photoPath ?? null
  )
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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

  function handleGeneratePassword() {
    const pwd = generateSecurePassword()
    setPassword(pwd)
    setConfirmPassword(pwd)
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
    if (password || confirmPassword) {
      if (password.length < 8) {
        toast.error("A nova senha deve ter no mínimo 8 caracteres.")
        return
      }
      if (password !== confirmPassword) {
        toast.error("A confirmação da senha não confere.")
        return
      }
    }

    startTransition(async () => {
      // undefined = no change, null = explicitly removed, string = new upload
      let resolvedPhotoPath: string | null | undefined = undefined

      if (photoFile) {
        const fd = new FormData()
        fd.set("photo", photoFile)
        const res = await fetch(`/api/usuarios/${id}/avatar`, {
          method: "PUT",
          body: fd,
        })
        if (res.ok) {
          const json = await res.json() as { photoPath: string }
          resolvedPhotoPath = json.photoPath
        } else {
          const errorJson = await res.json().catch(() => ({})) as { error?: string }
          toast.error(errorJson.error ?? "Erro ao enviar a foto. Tente novamente.")
          return
        }
      } else if (photoPreview === null && initialProfile.photoPath) {
        // Photo was explicitly removed
        resolvedPhotoPath = null
      }

      const result = await atualizarQaUser(id, {
        name: nome,
        email,
        type: tipo,
        classificacao: cargo.trim() || null,
        dataNascimento: dataNascimento.trim() || null,
        horarioEntrada: horarioEntrada.trim() || null,
        horarioSaida: horarioSaida.trim() || null,
        formatoTrabalho: sanitizeFormatoTrabalho(formatoTrabalho) ?? "Presencial",
        photoPath: resolvedPhotoPath,
        newPassword: password.trim() || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      setPassword("")
      setConfirmPassword("")
      toast.success("Cadastro atualizado com sucesso.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
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
          <span className="font-medium text-text-primary">Editar — {id}</span>
        </div>
        <Button onClick={handleSave} disabled={isPending}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Main form ── */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-4 lg:col-span-2">
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
            {isAdmin ? (
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? initialProfile.type)} disabled={isPending}>
                <SelectTrigger id="tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="Padrão">Padrão</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                </SelectPopup>
              </Select>
            ) : (
              <div
                id="tipo"
                className="flex h-9 w-full items-center rounded-custom border border-border-default bg-surface-input px-3 text-sm text-text-secondary"
              >
                {tipo}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="cargo" className="text-sm font-medium text-text-primary">
                Cargo
              </label>
              {isAdmin ? (
                <Input
                  id="cargo"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex.: Analista de QA"
                  maxLength={120}
                  disabled={isPending}
                  className="w-full"
                />
              ) : (
                <div
                  id="cargo"
                  className="flex min-h-9 w-full items-center rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-secondary"
                >
                  {cargo.trim() ? cargo : "—"}
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-1.5">
              <label htmlFor="dataNascimento" className="text-sm font-medium text-text-primary">
                Data de Nascimento
              </label>
              <div className="relative w-full min-w-0">
                <Input
                  id="dataNascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  disabled={isPending}
                  className={inputNativePickerRightClassName()}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-start">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="horarioEntrada" className="text-sm font-medium text-text-primary">
                Horário de Entrada
              </label>
              <Input
                id="horarioEntrada"
                type="time"
                value={horarioEntrada}
                onChange={(e) => setHorarioEntrada(e.target.value)}
                disabled={isPending}
                className={inputNativePickerRightClassName()}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="horarioSaida" className="text-sm font-medium text-text-primary">
                Horário Saída
              </label>
              <Input
                id="horarioSaida"
                type="time"
                value={horarioSaida}
                onChange={(e) => setHorarioSaida(e.target.value)}
                disabled={isPending}
                className={inputNativePickerRightClassName()}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="formatoTrabalho" className="text-sm font-medium text-text-primary">
                Formato
              </label>
              <Select
                value={formatoTrabalho}
                onValueChange={(v) => setFormatoTrabalho(v ?? "Presencial")}
                disabled={isPending}
              >
                <SelectTrigger id="formatoTrabalho" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {FORMATOS_TRABALHO.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          {/* ── Password section ── */}
          <div className="border-t border-border-default pt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-text-primary">
                Alterar senha{" "}
                <span className="text-xs font-normal text-text-secondary">(opcional)</span>
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
                <label htmlFor="password" className="text-sm font-medium text-text-primary">Nova senha</label>
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
                    {showPassword
                      ? <EyeOff className="size-4" />
                      : <Eye className="size-4" />
                    }
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-text-primary">Confirmar nova senha</label>
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
                    {showConfirm
                      ? <EyeOff className="size-4" />
                      : <Eye className="size-4" />
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Photo upload ── */}
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
