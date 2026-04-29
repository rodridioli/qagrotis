"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { criarSistema } from "@/lib/actions/sistemas"
import { toast } from "sonner"

export default function NovoSistemaForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")

  function handleSave() {
    if (!nome.trim()) {
      toast.error("O nome é obrigatório.")
      return
    }
    startTransition(async () => {
      await criarSistema({ name: nome, description: descricao || null })
      toast.success("Sistema criado com sucesso.")
      router.push("/configuracoes/sistemas")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Sistemas", href: "/configuracoes/sistemas" },
            { label: "Novo Sistema" },
          ]}
        />
        <Button onClick={handleSave} disabled={isPending}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="max-w-2xl space-y-4 rounded-xl bg-surface-card p-5 shadow-card">
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
            className="w-full resize-none rounded-custom border border-border-default bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-50 disabled:pointer-events-none"
          />
        </div>
      </div>
    </div>
  )
}
