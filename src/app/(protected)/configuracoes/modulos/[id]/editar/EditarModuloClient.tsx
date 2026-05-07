"use client"

import React, { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { PageBreadcrumb } from "@/components/shared/PageBreadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { atualizarModulo, type ModuloRecord } from "@/features/qa/actions/modulos"
import { type SistemaRecord } from "@/features/qa/actions/sistemas"
import { toast } from "sonner"

interface Props {
  modulo: ModuloRecord
  sistemas: SistemaRecord[]
}

export default function EditarModuloClient({ modulo, sistemas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(modulo.name)
  const [descricao, setDescricao] = useState(modulo.description ?? "")
  const [sistemaNome, setSistemaNome] = useState(modulo.sistemaName)
  const [fieldErrors, setFieldErrors] = useState<{ nome?: boolean; sistema?: boolean }>({})

  useEffect(() => {
    if (sistemas.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de editar módulos.")
  }, [sistemas.length])

  function handleSave() {
    const errs: { nome?: boolean; sistema?: boolean } = {}
    if (!nome.trim()) errs.nome = true
    if (!sistemaNome) errs.sistema = true
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      if (errs.nome) toast.error("O nome do módulo é obrigatório.")
      else toast.error("Selecione um sistema.")
      return
    }
    setFieldErrors({})
    const sistema = sistemas.find((s) => s.name === sistemaNome)
    startTransition(async () => {
      await atualizarModulo(modulo.id, {
        name: nome,
        description: descricao || null,
        sistemaId: sistema?.id ?? modulo.sistemaId,
        sistemaName: sistemaNome,
      })
      toast.success("Módulo atualizado com sucesso.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Módulos", href: "/configuracoes/modulos" },
            { label: `Editar — ${modulo.id}` },
          ]}
        />
        <Button onClick={handleSave} disabled={isPending}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="max-w-2xl rounded-xl bg-surface-card p-5 shadow-card space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Nome <span className="text-destructive">*</span>
          </label>
          <Input
            value={nome}
            onChange={(e) => { setNome(e.target.value); setFieldErrors((p) => ({ ...p, nome: false })) }}
            placeholder="Nome do módulo"
            disabled={isPending}
            aria-invalid={!!fieldErrors.nome}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Sistema <span className="text-destructive">*</span>
          </label>
          <Select value={sistemaNome} onValueChange={(v) => { setSistemaNome(v ?? ""); setFieldErrors((p) => ({ ...p, sistema: false })) }} disabled={sistemas.length === 0 || isPending}>
            <SelectTrigger className={fieldErrors.sistema ? "border-destructive ring-2 ring-destructive/20" : ""}><SelectValue placeholder={sistemas.length === 0 ? "Nenhum sistema cadastrado" : "Selecionar sistema"} /></SelectTrigger>
            <SelectPopup>
              {sistemas.map((s) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="descricao" className="text-sm font-medium text-text-primary">Descrição</label>
          <textarea
            id="descricao"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o módulo..."
            disabled={isPending}
            className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none disabled:opacity-50 disabled:pointer-events-none"
          />
        </div>
      </div>
    </div>
  )
}
