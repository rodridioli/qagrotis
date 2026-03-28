import React from "react"
import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import { notFound } from "next/navigation"
import { getSistema } from "@/lib/actions/sistemas"

export default async function SistemaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sistema = await getSistema(id)

  if (!sistema) notFound()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes/sistemas"
            title="Voltar"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href="/configuracoes/sistemas" className="text-text-secondary hover:text-brand-primary">
            Sistemas
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">{sistema.id}</span>
        </div>
        <Link href={`/configuracoes/sistemas/${id}/editar`}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-custom border border-border-default bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-neutral-grey-50"
          >
            <Pencil className="size-3.5" />
            Editar
          </button>
        </Link>
      </div>

      <div className="max-w-2xl rounded-xl bg-surface-card p-5 shadow-card space-y-5">
        <h2 className="font-semibold text-text-primary">Dados do Sistema</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">ID</p>
            <p className="text-sm text-text-primary">{sistema.id}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Nome</p>
            <p className="text-sm text-text-primary">{sistema.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Status</p>
            {sistema.active ? (
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                Ativo
              </span>
            ) : (
              <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-neutral-grey-300 bg-neutral-grey-100 px-3 py-1 text-xs font-medium text-text-secondary">
                Inativo
              </span>
            )}
          </div>
        </div>

        {sistema.description && (
          <div className="space-y-1 border-t border-border-default pt-4">
            <p className="text-xs font-medium text-text-secondary">Descrição</p>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{sistema.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
