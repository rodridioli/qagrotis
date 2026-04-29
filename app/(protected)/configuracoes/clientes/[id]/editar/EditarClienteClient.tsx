"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { atualizarCliente, type ClienteRecord } from "@/lib/actions/clientes"
import { formatCpfCnpj, validateCpfCnpj } from "@/lib/utils"
import { toast } from "sonner"

interface Props {
  cliente: ClienteRecord
}

export default function EditarClienteClient({ cliente }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [nomeFantasia, setNomeFantasia] = useState(cliente.nomeFantasia)
  const [razaoSocial, setRazaoSocial] = useState(cliente.razaoSocial ?? "")
  const [cpfCnpj, setCpfCnpj] = useState(cliente.cpfCnpj ?? "")

  function handleSave() {
    if (!nomeFantasia.trim()) {
      toast.error("O Nome Fantasia é obrigatório.")
      return
    }
    if (cpfCnpj.trim() && !validateCpfCnpj(cpfCnpj)) {
      toast.error("CPF ou CNPJ inválido.")
      return
    }
    startTransition(async () => {
      await atualizarCliente(cliente.id, {
        nomeFantasia,
        razaoSocial: razaoSocial || null,
        cpfCnpj: cpfCnpj || null,
      })
      toast.success("Cliente atualizado com sucesso.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageBreadcrumb
          items={[
            { label: "Configurações", href: "/configuracoes" },
            { label: "Clientes", href: "/configuracoes/clientes" },
            { label: `Editar — ${cliente.id}` },
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
            Nome Fantasia <span className="text-destructive">*</span>
          </label>
          <Input
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            placeholder="Nome Fantasia"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">Razão Social</label>
          <Input
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            placeholder="Razão Social"
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">CPF / CNPJ</label>
          <Input
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  )
}
