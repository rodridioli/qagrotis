"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { atualizarSistema, type SistemaRecord } from "@/lib/actions/sistemas"
import { toast } from "sonner"

interface Props {
  sistema: SistemaRecord
}

export default function EditarSistemaClient({ sistema }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState(sistema.name)
  const [descricao, setDescricao] = useState(sistema.description ?? "")

  function handleSave() {
    if (!nome.trim()) {
      toast.error("O nome é obrigatório.")
      return
    }
    startTransition(async () => {
      await atualizarSistema(sistema.id, { name: nome, description: descricao || null })
      toast.success("Sistema atualizado com sucesso.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Sistemas", href: "/configuracoes/sistemas" },
            { label: `Editar — ${sistema.id}` },
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
            placeholder="Nome do sistema"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="descricao" className="text-sm font-medium text-text-primary">Descrição</label>
          <textarea
            id="descricao"
            rows={4}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o sistema..."
            disabled={isPending}
            className="w-full rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 resize-none disabled:opacity-50 disabled:pointer-events-none"
          />
        </div>
      </div>
    </div>
  )
}
