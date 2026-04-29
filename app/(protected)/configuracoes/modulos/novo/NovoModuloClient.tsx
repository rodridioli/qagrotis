"use client"

import React, { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
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
import { criarModulo } from "@/lib/actions/modulos"
import { type SistemaRecord } from "@/lib/actions/sistemas"
import { toast } from "sonner"

interface Props {
  sistemas: SistemaRecord[]
}

export default function NovoModuloClient({ sistemas }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")
  const [sistemaNome, setSistemaNome] = useState("")

  useEffect(() => {
    if (sistemas.length === 0)
      toast.warning("É preciso cadastrar um sistema antes de criar módulos.")
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
    const sistema = sistemas.find((s) => s.name === sistemaNome)!
    startTransition(async () => {
      await criarModulo({
        name: nome,
        description: descricao || null,
        sistemaId: sistema.id,
        sistemaName: sistema.name,
      })
      toast.success("Módulo criado com sucesso.")
      router.push("/configuracoes/modulos")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Módulos", href: "/configuracoes/modulos" },
            { label: "Novo Módulo" },
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
