"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
          <Button variant="outline" onClick={handleClick} disabled={isPending}>
            <Trash2 />
            {isPending ? "Limpando..." : "Limpar registros inativos"}
          </Button>
        ) : (
          <>
            <Button variant="destructive" onClick={handleClick} disabled={isPending}>
              <AlertTriangle />
              Confirmar limpeza
            </Button>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
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
