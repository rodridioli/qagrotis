"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { MOCK_CENARIOS } from "@/lib/qagrotis-constants"

const MOCK_STEPS = [
  { id: 1, acao: "Acessar menu Cadastros > Produtores", resultado: "Tela de listagem com botão novo", status: "Pendente" },
  { id: 2, acao: "Clicar em Novo Produtor", resultado: "Formulário de cadastro aberto", status: "Pendente" },
  { id: 3, acao: "Preencher campo Nome", resultado: "Campo preenchido sem erros", status: "Pendente" },
]

const MOCK_DEPS = [
  { id: "CT-001", name: "Login e Autenticação", module: "Users", system: "Gerencial" },
  { id: "CT-005", name: "Configuração de Permissões", module: "Configurações", system: "Gerencial" },
]

export default function CenarioDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const cenario = MOCK_CENARIOS.find((c) => c.id === params.id) ?? MOCK_CENARIOS[0]
  const [stepStatuses, setStepStatuses] = useState<Record<number, string>>(
    Object.fromEntries(MOCK_STEPS.map((s) => [s.id, s.status]))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/cenarios"
            title="Voltar"
            className="flex items-center gap-1 text-text-secondary hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
            Cenários
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">{cenario.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <Check className="size-4" />
            Salvar
          </Button>
          <Button className="bg-primary-700 hover:bg-primary-800" style={{ color: "#ffffff" }}>Sucesso</Button>
          <Button variant="destructive">Erro</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-text-primary">Informações do Cenário</h2>
          <div className="space-y-2 text-sm">
            {[
              ["Cenário", cenario.scenarioName],
              ["Sistema", cenario.system],
              ["Módulo", cenario.module],
              ["Cliente", cenario.client],
              ["Prioridade", "Alto"],
              ["Tipo", cenario.tipo],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs text-text-secondary">{label}</span>
                <span className="font-medium text-text-primary">{value}</span>
              </div>
            ))}
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-secondary">Regra de Negócio</span>
              <p className="text-text-primary">Validar dados antes de salvar o produtor.</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-secondary">Descrição</span>
              <p className="text-text-primary">Verificar que o cadastro funciona corretamente.</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-secondary">Pré-condições</span>
              <p className="text-text-primary">Usuário logado com permissão de cadastro.</p>
            </div>
          </div>
          <Link href={`/cenarios/${cenario.id}/editar`} className="text-sm text-brand-primary hover:underline">
            Editar
          </Link>
        </div>

        <div className="space-y-4">
          {cenario.tipo !== "Manual" && (
            <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
              <h2 className="font-semibold text-text-primary">Testes Automatizados</h2>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-text-secondary">Status de Automação</label>
                  <Select defaultValue="pendente">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em-andamento">Em andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                    </SelectPopup>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-text-secondary">URL do Script</label>
                  <input
                    type="text"
                    placeholder="https://github.com/..."
                    className="flex h-9 w-full rounded-custom border border-border-default bg-surface-input px-3 text-sm text-text-primary placeholder:text-text-secondary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
            <h2 className="font-semibold text-text-primary">Testes Manuais</h2>
            <div className="space-y-3">
              {MOCK_STEPS.map((step, idx) => (
                <div key={step.id} className="rounded-lg border border-border-default p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Passo {idx + 1}</span>
                    <Select
                      value={stepStatuses[step.id]}
                      onValueChange={(v: string | null) =>
                        setStepStatuses((prev) => ({ ...prev, [step.id]: v ?? "Pendente" }))
                      }
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectPopup>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Sucesso">Sucesso</SelectItem>
                        <SelectItem value="Erro">Erro</SelectItem>
                      </SelectPopup>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Ação</p>
                    <p className="text-sm text-text-primary">{step.acao}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Resultado esperado</p>
                    <p className="text-sm text-text-primary">{step.resultado}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface-card p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-text-primary">
            Dependências ({MOCK_DEPS.length})
          </h2>
          <div className="space-y-2">
            {MOCK_DEPS.map((dep) => (
              <div
                key={dep.id}
                className="rounded-lg border border-border-default p-3 space-y-0.5"
              >
                <Link
                  href={`/cenarios/${dep.id}`}
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  {dep.id}
                </Link>
                <p className="text-xs text-text-secondary">
                  {dep.system} › {dep.module}
                </p>
                <p className="text-sm text-text-primary">{dep.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
