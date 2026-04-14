"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { limparRegistrosInativos, type LimparResult } from "@/lib/actions/admin"

export default function LimparBancoButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<LimparResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setConfirmando(false)
    setResult(null)
    setError(null)
    startTransition(async () => {
      try {
        const res = await limparRegistrosInativos()
        setResult(res)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao limpar registros.")
      }
    })
  }

  const total = result
    ? result.cenarios + result.suites + result.modulos + result.sistemas +
      result.clientes + result.integracoes + result.usuarios
    : 0

  return (
    <div className="rounded-xl border border-neutral-grey-200 bg-surface-card p-6 shadow-card">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Trash2 className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary">Limpeza de banco de dados</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Remove permanentemente todos os registros inativos: cenários, suítes, módulos, sistemas, clientes, integrações e usuários desativados.
          </p>

          {result && (
            <p className="mt-3 text-sm text-green-600 font-medium">
              {total === 0
                ? "Nenhum registro inativo encontrado."
                : `${total} registro${total !== 1 ? "s" : ""} removido${total !== 1 ? "s" : ""}: ${[
                    result.cenarios > 0 && `${result.cenarios} cenário${result.cenarios !== 1 ? "s" : ""}`,
                    result.suites > 0 && `${result.suites} suíte${result.suites !== 1 ? "s" : ""}`,
                    result.modulos > 0 && `${result.modulos} módulo${result.modulos !== 1 ? "s" : ""}`,
                    result.sistemas > 0 && `${result.sistemas} sistema${result.sistemas !== 1 ? "s" : ""}`,
                    result.clientes > 0 && `${result.clientes} cliente${result.clientes !== 1 ? "s" : ""}`,
                    result.integracoes > 0 && `${result.integracoes} integração${result.integracoes !== 1 ? "ões" : ""}`,
                    result.usuarios > 0 && `${result.usuarios} usuário${result.usuarios !== 1 ? "s" : ""}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}.`}
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleClick}
              disabled={isPending}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                confirmando
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-neutral-grey-100 text-text-primary hover:bg-neutral-grey-200"
              }`}
            >
              <Trash2 className="size-4" />
              {isPending
                ? "Limpando..."
                : confirmando
                ? "Confirmar limpeza"
                : "Limpar registros inativos"}
            </button>

            {confirmando && !isPending && (
              <button
                onClick={() => setConfirmando(false)}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>

          {confirmando && (
            <p className="mt-2 text-xs text-red-600">
              Atenção: esta ação é irreversível. Os registros serão excluídos permanentemente.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
