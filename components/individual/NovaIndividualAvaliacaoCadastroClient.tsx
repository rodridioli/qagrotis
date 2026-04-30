"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { PageBreadcrumb } from "@/components/qagrotis/PageBreadcrumb"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/equipe/EquipePerformanceCard"
import type { EvaluatedUserSummary } from "@/components/individual/individualEvaluationTypes"
import { createDraftIndividualPerformanceEvaluation } from "@/lib/actions/individual-performance-evaluations"

export interface NovaIndividualAvaliacaoCadastroClientProps {
  evaluatedUserId: string
  evaluatedUser: EvaluatedUserSummary
}

export function NovaIndividualAvaliacaoCadastroClient({
  evaluatedUserId,
  evaluatedUser,
}: NovaIndividualAvaliacaoCadastroClientProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const userQuery = `?userId=${encodeURIComponent(evaluatedUserId)}`
  const listHref = `/individual/avaliacoes${userQuery}`
  const fichaHref = `/individual/ficha${userQuery}`

  async function onContinue() {
    setPending(true)
    try {
      const res = await createDraftIndividualPerformanceEvaluation(evaluatedUserId)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      router.push(`/individual/avaliacoes/${res.id}${userQuery}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a avaliação.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageBreadcrumb
        backHref={listHref}
        items={[
          { label: "Individual", href: fichaHref },
          { label: "Avaliações", href: listHref },
          { label: "Nova avaliação" },
        ]}
      />

      <div>
        <h1 className="text-xl font-semibold text-text-primary">Nova avaliação</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Confirme o avaliado e continue para o formulário. O rascunho só é criado quando clicar em Continuar.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface-card p-4 shadow-card sm:flex-row sm:items-center">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <UserAvatar name={evaluatedUser.name || " "} photoPath={evaluatedUser.photoPath} size={72} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
          <p className="text-base font-semibold text-text-primary">{evaluatedUser.name}</p>
          {evaluatedUser.email ? (
            <p className="truncate text-sm text-text-secondary">{evaluatedUser.email}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(listHref)}>
          Voltar
        </Button>
        <Button type="button" className="gap-2" disabled={pending} onClick={() => void onContinue()}>
          {pending ? "A preparar…" : "Continuar"}
          {!pending ? <ArrowRight className="size-4 shrink-0" aria-hidden /> : null}
        </Button>
      </div>
    </div>
  )
}
