"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, EyeOff, RefreshCw } from "lucide-react"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
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
import { generateSecurePassword } from "@/lib/generate-secure-password"
import { inputNativePickerRightClassName } from "@/lib/input-native-picker-classes"
import { HybridWorkWeekdaysField } from "@/components/qagrotis/HybridWorkWeekdaysField"
import {
  FORMATOS_TRABALHO,
  normalizeDiasTrabalhoHibrido,
  sanitizeFormatoTrabalho,
  type DiaSemanaHibridoId,
} from "@/lib/usuario-trabalho"
import { toast } from "sonner"
import { ACCESS_PROFILES, type AccessProfile } from "@/lib/rbac/policy"

interface NovoUsuarioFormProps {
  /** Perfis que o admin logado pode atribuir (vem do server). */
  manageableProfiles?: AccessProfile[]
}

export default function NovoUsuarioForm({ manageableProfiles = ACCESS_PROFILES }: NovoUsuarioFormProps = {}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [tipo, setTipo] = useState<string>("Padrão")
  const [accessProfile, setAccessProfile] = useState<AccessProfile>(manageableProfiles[0] ?? "QA")
  const [cargo, setCargo] = useState("")
  const [dataNascimento, setDataNascimento] = useState("")
  const [horarioEntrada, setHorarioEntrada] = useState("")
  const [horarioSaida, setHorarioSaida] = useState("")
  const [formatoTrabalho, setFormatoTrabalho] = useState<string>("Presencial")
  const [diasHibrido, setDiasHibrido] = useState<DiaSemanaHibridoId[]>([])
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
      const result = await criarQaUser({
        name: nome,
        email,
        type: tipo,
        accessProfile,
        classificacao: cargo.trim() || null,
        dataNascimento: dataNascimento.trim() || null,
        horarioEntrada: horarioEntrada.trim() || null,
        horarioSaida: horarioSaida.trim() || null,
        formatoTrabalho: sanitizeFormatoTrabalho(formatoTrabalho) ?? "Presencial",
        diasTrabalhoHibrido: normalizeDiasTrabalhoHibrido(diasHibrido),
        password,
      })
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
            accessProfile,
            classificacao: cargo.trim() || null,
            dataNascimento: dataNascimento.trim() || null,
            horarioEntrada: horarioEntrada.trim() || null,
            horarioSaida: horarioSaida.trim() || null,
            formatoTrabalho: sanitizeFormatoTrabalho(formatoTrabalho) ?? "Presencial",
            diasTrabalhoHibrido: normalizeDiasTrabalhoHibrido(diasHibrido),
            photoPath,
          })
        } else {
          const errorJson = await res.json().catch(() => ({})) as { error?: string }
          toast.warning(`Usuário criado, mas houve erro na foto: ${errorJson.error ?? "Erro desconhecido"}`)
        }
      }

      if (result.emailEnviado) {
        toast.success("Usuário criado. E-mail de convite enviado.")
      } else {
        toast.success("Usuário criado. O e-mail de convite não pôde ser enviado — gere um novo convite manualmente.")
      }
      router.push("/configuracoes/usuarios")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Usuários", href: "/configuracoes/usuarios" },
            { label: "Novo Usuário" },
          ]}
        />
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="tipo" className="text-sm font-medium text-text-primary">
                Tipo <span className="text-destructive">*</span>
              </label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  const next = v ?? "Padrão"
                  setTipo(next)
                  if (next === "Padrão" && accessProfile === "MGR") {
                    setAccessProfile(manageableProfiles.find((p) => p !== "MGR") ?? "QA")
                  }
                }}
                disabled={isPending || accessProfile === "MGR"}
              >
                <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                <SelectPopup>
                  <SelectItem value="Padrão">Padrão</SelectItem>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                </SelectPopup>
              </Select>
              {accessProfile === "MGR" && (
                <p className="text-xs text-text-secondary">MGR exige Tipo Administrador.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="accessProfile" className="text-sm font-medium text-text-primary">
                Perfil de Acesso <span className="text-destructive">*</span>
              </label>
              <Select
                value={accessProfile}
                onValueChange={(v) => {
                  const next = (v ?? "QA") as AccessProfile
                  setAccessProfile(next)
                  if (next === "MGR") setTipo("Administrador")
                }}
                disabled={isPending}
              >
                <SelectTrigger id="accessProfile"><SelectValue /></SelectTrigger>
                <SelectPopup>
                  {manageableProfiles.map((p) => (
                    <SelectItem
                      key={p}
                      value={p}
                      disabled={p === "MGR" && tipo === "Padrão"}
                    >
                      {p}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="cargo" className="text-sm font-medium text-text-primary">
                Cargo
              </label>
              <Input
                id="cargo"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ex.: Analista de QA"
                maxLength={120}
                disabled={isPending}
                className="w-full"
              />
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
                onValueChange={(v) => {
                  const next = v ?? "Presencial"
                  setFormatoTrabalho(next)
                  if (next !== "Híbrido") setDiasHibrido([])
                }}
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

          {formatoTrabalho === "Híbrido" ? (
            <HybridWorkWeekdaysField
              idPrefix="novo-usuario"
              value={diasHibrido}
              onChange={setDiasHibrido}
              disabled={isPending}
              className="mt-1"
            />
          ) : null}

          {/* ── Password section ── */}
          <div className="border-t border-border-default pt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              O usuário receberá um e-mail de convite com link para definir a própria senha (a senha acima fica como reserva e não é enviada por e-mail).
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
