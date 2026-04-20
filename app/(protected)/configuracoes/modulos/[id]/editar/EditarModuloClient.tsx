"use client"

import React, { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { atualizarModulo, type ModuloRecord } from "@/lib/actions/modulos"
import { type SistemaRecord } from "@/lib/actions/sistemas"
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

  useEffect(() => {
    if (sistemas.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de editar módulos.")
  }, [sistemas.length])

  function handleSave() {
    if (!nome.trim()) {
      toast.error("O nome do módulo é obrigatório.")
      return
    }
    if (!sistemaNome) {
      toast.error("Selecione um sistema.")
      return
    }
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
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes/modulos"
            title="Voltar"
            aria-label="Voltar"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href="/configuracoes/modulos" className="text-text-secondary hover:text-brand-primary">
            Módulos
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Editar — {modulo.id}</span>
        </div>
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
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do módulo"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            Sistema <span className="text-destructive">*</span>
          </label>
          <Select value={sistemaNome} onValueChange={(v) => setSistemaNome(v ?? "")} disabled={sistemas.length === 0 || isPending}>
            <SelectTrigger><SelectValue placeholder={sistemas.length === 0 ? "Nenhum sistema cadastrado" : "Selecionar sistema"} /></SelectTrigger>
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
