"use client"

import React from "react"
import Link from "next/link"
import { use } from "react"
import { ArrowLeft } from "lucide-react"
import { MOCK_USERS } from "@/lib/qagrotis-constants"
import { notFound } from "next/navigation"

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === "Administrador") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
        {tipo}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-secondary-500/30 bg-secondary-500/10 px-3 py-1 text-xs font-medium text-secondary-600">
      {tipo}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-sm text-text-primary">{value}</p>
    </div>
  )
}

export default function UsuarioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const user = MOCK_USERS.find((u) => u.id === id)

  if (!user) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-sm">
        <Link
          href="/configuracoes/usuarios"
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
        <span className="font-medium text-text-primary">{user.id}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main info */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-5 lg:col-span-2">
          <h2 className="font-semibold text-text-primary">Dados do Usuário</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ID" value={user.id} />
            <Field label="Nome" value={user.name} />
            <Field label="E-mail" value={user.email} />
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-secondary">Tipo</p>
              <TipoBadge tipo={user.type} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-secondary">Status</p>
              {user.active ? (
                <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary">
                  Ativo
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-neutral-grey-300 bg-neutral-grey-100 px-3 py-1 text-xs font-medium text-text-secondary">
                  Inativo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar */}
        <div className="rounded-xl bg-surface-card p-5 shadow-card flex flex-col items-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary-100 text-2xl font-semibold text-brand-primary">
            {getInitials(user.name)}
          </div>
          <div className="text-center">
            <p className="font-semibold text-text-primary">{user.name}</p>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
          <TipoBadge tipo={user.type} />
        </div>
      </div>
    </div>
  )
}
