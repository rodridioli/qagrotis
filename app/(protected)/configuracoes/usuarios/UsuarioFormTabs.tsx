"use client"

import React, { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Check, Eye, EyeOff, RefreshCw, Plus, Trash2, ExternalLink, MessageSquare, MapIcon as Map, BookOpen, User as UserIcon } from "lucide-react"
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
import { criarQaUser, atualizarQaUser, type QaUserProfile } from "@/lib/actions/usuarios"
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
import { useSession } from "next-auth/react"
import { ACCESS_PROFILES, type AccessProfile } from "@/lib/rbac/policy"

interface UsuarioFormTabsProps {
  mode: "create" | "edit"
  userId?: string
  initialData?: QaUserProfile
  manageableProfiles?: AccessProfile[]
  sessionUser?: { id: string; type: string; accessProfile?: string }
}

export default function UsuarioFormTabs({
  mode,
  userId,
  initialData,
  manageableProfiles = ACCESS_PROFILES,
  sessionUser,
}: UsuarioFormTabsProps) {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"cadastro" | "endereco" | "formacao">("cadastro")

  // --- Cadastro ---
  const [nome, setNome] = useState(initialData?.name ?? "")
  const [email, setEmail] = useState(initialData?.email ?? "")
  const [tipo, setTipo] = useState<string>(initialData?.type ?? "Padrão")
  const [accessProfile, setAccessProfile] = useState<AccessProfile>((initialData?.accessProfile as AccessProfile) ?? manageableProfiles[0] ?? "QA")
  /** Admin QA/UX/TW: só um perfil gerenciável — campo travado nesse valor. */
  const accessProfileSelectDisabled = manageableProfiles.length === 1
  const lockedAccessProfile = accessProfileSelectDisabled ? manageableProfiles[0] ?? null : null

  useEffect(() => {
    if (!lockedAccessProfile) return
    setAccessProfile(lockedAccessProfile)
  }, [lockedAccessProfile])
  const [cargo, setCargo] = useState(initialData?.classificacao ?? "")
  const [dataNascimento, setDataNascimento] = useState(initialData?.dataNascimento ?? "")
  const [horarioEntrada, setHorarioEntrada] = useState(initialData?.horarioEntrada ?? "")
  const [horarioSaida, setHorarioSaida] = useState(initialData?.horarioSaida ?? "")
  const [formatoTrabalho, setFormatoTrabalho] = useState<string>(initialData?.formatoTrabalho ?? "Presencial")
  const [diasHibrido, setDiasHibrido] = useState<DiaSemanaHibridoId[]>((initialData?.diasTrabalhoHibrido as DiaSemanaHibridoId[]) ?? [])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photoPath ?? null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // --- Endereço e Contato ---
  const [cep, setCep] = useState(initialData?.cep ?? "")
  const [address, setAddress] = useState(initialData?.address ?? "")
  const [addressNumber, setAddressNumber] = useState(initialData?.addressNumber ?? "")
  const [neighborhood, setNeighborhood] = useState(initialData?.neighborhood ?? "")
  const [city, setCity] = useState(initialData?.city ?? "")
  const [state, setState] = useState(initialData?.state ?? "")
  const [country, setCountry] = useState(initialData?.country ?? "Brasil")
  const [phone, setPhone] = useState(initialData?.phone ?? "")
  const [emergencyContact, setEmergencyContact] = useState(initialData?.emergencyContact ?? "")
  const [instagram, setInstagram] = useState(initialData?.instagram ?? "")
  const [linkedin, setLinkedin] = useState(initialData?.linkedin ?? "")

  // --- Formação e Cursos ---
  const [education, setEducation] = useState<any[]>(initialData?.education ?? [])
  const [courses, setCourses] = useState<any[]>(initialData?.courses ?? [])
  const [languages, setLanguages] = useState<any[]>(initialData?.languages ?? [])
  const [certifications, setCertifications] = useState<any[]>(initialData?.certifications ?? [])

  const canSeeRestricted = mode === "create" || (sessionUser?.id === userId || (sessionUser?.type === "Administrador" && sessionUser?.accessProfile === "MGR"))

  const TABS = [
    { id: "cadastro" as const, label: "Cadastro", icon: UserIcon, disabled: false },
    { id: "endereco" as const, label: "Endereço", icon: Map, disabled: !canSeeRestricted },
    { id: "formacao" as const, label: "Formação", icon: BookOpen, disabled: !canSeeRestricted },
  ]

  // --- Helpers ---
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

  async function handleCepBlur() {
    const cleanCep = cep.replace(/\D/g, "")
    if (cleanCep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setAddress(data.logradouro)
        setNeighborhood(data.bairro)
        setCity(data.localidade)
        setState(data.uf)
        setCountry("Brasil")
      }
    } catch (e) {
      console.error("Erro ao buscar CEP", e)
    }
  }

  function handleSave() {
    if (!nome.trim()) { toast.error("O nome é obrigatório."); return }
    if (!email.trim()) { toast.error("O e-mail é obrigatório."); return }
    if (mode === "create" && password.length < 8) { toast.error("A senha deve ter no mínimo 8 caracteres."); return }
    if (password && password !== confirmPassword) { toast.error("As senhas não coincidem."); return }

    startTransition(async () => {
      const payload: any = {
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
        cep: cep.trim() || null,
        address: address.trim() || null,
        addressNumber: addressNumber.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        country: country.trim() || null,
        phone: phone.trim() || null,
        emergencyContact: emergencyContact.trim() || null,
        instagram: instagram.trim() || null,
        linkedin: linkedin.trim() || null,
        education,
        courses,
        languages,
        certifications,
      }

      if (mode === "create") {
        payload.password = password
        const result = await criarQaUser(payload)
        if (result.error || !result.id) {
          toast.error(result.error ?? "Erro ao criar usuário.")
          return
        }
        await handlePhotoUpload(result.id)
        toast.success(result.emailEnviado ? "Usuário criado. E-mail enviado." : "Usuário criado.")
        router.push("/configuracoes/usuarios")
      } else {
        if (password) payload.newPassword = password
        const result = await atualizarQaUser(userId!, payload)
        if (result.error) {
          toast.error(result.error)
          return
        }
        await handlePhotoUpload(userId!)
        toast.success("Usuário atualizado.")
        if (sessionUser?.id === userId) await updateSession()
        router.refresh()
      }
    })
  }

  async function handlePhotoUpload(targetId: string) {
    if (!photoFile) return
    const fd = new FormData()
    fd.set("photo", photoFile)
    const res = await fetch(`/api/usuarios/${targetId}/avatar`, { method: "PUT", body: fd })
    if (res.ok) {
      const json = await res.json()
      await atualizarQaUser(targetId, {
        name: nome,
        email,
        type: tipo,
        photoPath: json.photoPath,
      } as any)
    }
  }

  const isAdmin = sessionUser?.type === "Administrador"
  const backHref = isAdmin ? "/configuracoes/usuarios" : "/configuracoes"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          backHref={backHref}
          items={isAdmin ? [
            { label: "Configurações", href: "/configuracoes" },
            { label: "Usuários", href: "/configuracoes/usuarios" },
            { label: mode === "create" ? "Novo Usuário" : (initialData?.name ?? "Editar") },
          ] : [
            { label: "Configurações", href: "/configuracoes" },
            { label: mode === "create" ? "Novo Usuário" : (initialData?.name ?? "Editar") },
          ]}
        />
        <Button onClick={handleSave} disabled={isPending}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      {/* Tab container */}
      <div className="rounded-xl bg-surface-card shadow-card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-border-default overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              title={tab.disabled ? "Acesso restrito" : undefined}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-all ${
                tab.disabled
                  ? "cursor-not-allowed border-transparent text-text-secondary/40 opacity-50"
                  : activeTab === tab.id
                  ? "border-brand-primary text-brand-primary bg-brand-primary/5"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:bg-neutral-grey-50"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "cadastro" && (
            <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome <span className="text-destructive">*</span></label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">E-mail <span className="text-destructive">*</span></label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@empresa.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectPopup>
                        <SelectItem value="Padrão">Padrão</SelectItem>
                        <SelectItem value="Administrador">Administrador</SelectItem>
                      </SelectPopup>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Perfil de Acesso</label>
                    <Select
                      value={accessProfile}
                      onValueChange={(v) => {
                        if (accessProfileSelectDisabled) return
                        const next = (v ?? manageableProfiles[0] ?? "QA") as AccessProfile
                        setAccessProfile(next)
                      }}
                      disabled={accessProfileSelectDisabled}
                    >
                      <SelectTrigger aria-readonly={accessProfileSelectDisabled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        {manageableProfiles.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Cargo</label>
                    <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Analista de QA" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Data de Nascimento</label>
                    <Input value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} type="date" className={inputNativePickerRightClassName()} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Horário Entrada</label>
                    <Input value={horarioEntrada} onChange={(e) => setHorarioEntrada(e.target.value)} type="time" className={inputNativePickerRightClassName()} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Horário Saída</label>
                    <Input value={horarioSaida} onChange={(e) => setHorarioSaida(e.target.value)} type="time" className={inputNativePickerRightClassName()} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Formato</label>
                    <Select value={formatoTrabalho} onValueChange={setFormatoTrabalho}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectPopup>
                        {FORMATOS_TRABALHO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectPopup>
                    </Select>
                  </div>
                </div>
                {formatoTrabalho === "Híbrido" && (
                  <HybridWorkWeekdaysField value={diasHibrido} onChange={setDiasHibrido} />
                )}
                
                <div className="border-t border-border-default pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Senha {mode === "create" && <span className="text-destructive">*</span>}</p>
                    <Button variant="outline" size="sm" onClick={handleGeneratePassword}>
                      <RefreshCw className="size-3.5" /> Gerar senha
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha" />
                      <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar senha" />
                      <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                        {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-semibold text-text-primary">Foto de Perfil</h2>
                <PhotoUpload
                  preview={photoPreview}
                  onFileSelect={handlePhotoSelect}
                  onRemove={() => { setPhotoFile(null); setPhotoPreview(null) }}
                />
              </div>
            </div>
            </div>
          )}

          {activeTab === "endereco" && (
            <div className="p-5">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-8 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-medium">CEP</label>
                    <Input value={cep} onChange={(e) => setCep(e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
                  </div>
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-sm font-medium">Endereço</label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, Av..." />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-sm font-medium">Número</label>
                    <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="123" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Bairro</label>
                    <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Centro" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Cidade</label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Estado</label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">País</label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Brasil" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Telefone/Celular</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contato de Emergência</label>
                  <Input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Nome e telefone" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="size-3.5" /> Instagram</label>
                  <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5"><ExternalLink className="size-3.5" /> LinkedIn</label>
                  <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
              </div>
            </div>
            </div>
          )}

          {activeTab === "formacao" && (
            <div className="p-5">
            <div className="space-y-8">
              {/* Formação Acadêmica */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">Formação Acadêmica</h3>
                  <Button variant="outline" size="sm" onClick={() => setEducation([...education, { title: "", institution: "", year: "" }])}>
                    <Plus className="size-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {education.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-4"><Input value={item.title} onChange={e => { const n = [...education]; n[idx].title = e.target.value; setEducation(n) }} placeholder="Título (ex: Bacharel em Sistemas)" /></div>
                    <div className="md:col-span-3"><Input value={item.institution} onChange={e => { const n = [...education]; n[idx].institution = e.target.value; setEducation(n) }} placeholder="Instituição" /></div>
                    <div className="md:col-span-1"><Input value={item.year} onChange={e => { const n = [...education]; n[idx].year = e.target.value; setEducation(n) }} placeholder="Ano" /></div>
                    <div className="md:col-span-3">
                      <Select value={item.type ?? ""} onValueChange={(v) => { const n = [...education]; n[idx].type = v; setEducation(n) }}>
                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectPopup>
                          {["Ensino Médio", "Graduação", "Pós-Graduação", "Mestrado", "Doutorado", "Pós-Doutorado"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectPopup>
                      </Select>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEducation(education.filter((_, i) => i !== idx))}
                        className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover formação"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cursos */}
              <div className="space-y-4 pt-6 border-t border-border-default">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">Cursos</h3>
                  <Button variant="outline" size="sm" onClick={() => setCourses([...courses, { name: "", institution: "", year: "", hours: "" }])}>
                    <Plus className="size-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {courses.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-4 space-y-1"><Input value={item.name} onChange={e => { const n = [...courses]; n[idx].name = e.target.value; setCourses(n) }} placeholder="Nome" /></div>
                    <div className="md:col-span-3 space-y-1"><Input value={item.institution} onChange={e => { const n = [...courses]; n[idx].institution = e.target.value; setCourses(n) }} placeholder="Instituição" /></div>
                    <div className="md:col-span-2 space-y-1"><Input value={item.year} onChange={e => { const n = [...courses]; n[idx].year = e.target.value; setCourses(n) }} placeholder="Ano" /></div>
                    <div className="md:col-span-2 space-y-1"><Input value={item.hours} onChange={e => { const n = [...courses]; n[idx].hours = e.target.value; setCourses(n) }} placeholder="Horas" /></div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCourses(courses.filter((_, i) => i !== idx))}
                        className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover curso"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Idiomas */}
              <div className="space-y-4 pt-6 border-t border-border-default">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">Idiomas</h3>
                  <Button variant="outline" size="sm" onClick={() => setLanguages([...languages, { name: "", level: "Básico" }])}>
                    <Plus className="size-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {languages.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-6 space-y-1"><Input value={item.name} onChange={e => { const n = [...languages]; n[idx].name = e.target.value; setLanguages(n) }} placeholder="Idioma" /></div>
                    <div className="md:col-span-5 space-y-1">
                      <Select value={item.level} onValueChange={v => { const n = [...languages]; n[idx].level = v; setLanguages(n) }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectPopup>
                          {["Básico", "Intermediário", "Avançado", "Fluente / Nativo"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectPopup>
                      </Select>
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setLanguages(languages.filter((_, i) => i !== idx))}
                        className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover idioma"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Certificações */}
              <div className="space-y-4 pt-6 border-t border-border-default">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">Certificações</h3>
                  <Button variant="outline" size="sm" onClick={() => setCertifications([...certifications, { title: "", institution: "", year: "" }])}>
                    <Plus className="size-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
                {certifications.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5 space-y-1"><Input value={item.title} onChange={e => { const n = [...certifications]; n[idx].title = e.target.value; setCertifications(n) }} placeholder="Título" /></div>
                    <div className="md:col-span-4 space-y-1"><Input value={item.institution} onChange={e => { const n = [...certifications]; n[idx].institution = e.target.value; setCertifications(n) }} placeholder="Instituição" /></div>
                    <div className="md:col-span-2 space-y-1"><Input value={item.year} onChange={e => { const n = [...certifications]; n[idx].year = e.target.value; setCertifications(n) }} placeholder="Ano" /></div>
                    <div className="md:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCertifications(certifications.filter((_, i) => i !== idx))}
                        className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remover certificação"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
