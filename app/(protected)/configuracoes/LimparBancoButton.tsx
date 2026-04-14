"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Trash2 } from "lucide-react"
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {!confirmando ? (
          <button
            onClick={handleClick}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-grey-200 bg-surface-card px-4 py-2 text-sm font-medium text-text-primary shadow-card transition-colors hover:bg-neutral-grey-50 disabled:opacity-60"
          >
            <Trash2 className="size-4" />
            {isPending ? "Limpando..." : "Limpar registros inativos"}
          </button>
        ) : (
          <>
            <button
              onClick={handleClick}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              <AlertTriangle className="size-4" />
              Confirmar limpeza
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
          </>
        )}
      </div>

      {confirmando && (
        <p className="text-xs text-red-600">
          Atenção: esta ação é irreversível. Os registros inativos serão excluídos permanentemente.
        </p>
      )}

      {result && !confirmando && (
        <p className="text-sm text-green-600 font-medium">
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
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}
    </div>
  )
}
