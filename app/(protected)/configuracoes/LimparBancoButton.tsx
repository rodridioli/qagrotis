"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { limparRegistrosInativos, type LimparResult } from "@/lib/actions/admin"

export default function LimparBancoButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmando, setConfirmando] = useState(false)

  function buildMessage(res: LimparResult): string {
    const total = res.cenarios + res.suites + res.modulos + res.sistemas +
      res.clientes + res.integracoes + res.usuarios
    if (total === 0) return "Nenhum registro encontrado para remover."
    const partes = [
      res.cenarios   > 0 && `${res.cenarios} cenário${res.cenarios !== 1 ? "s" : ""}`,
      res.suites     > 0 && `${res.suites} suíte${res.suites !== 1 ? "s" : ""}`,
      res.modulos    > 0 && `${res.modulos} módulo${res.modulos !== 1 ? "s" : ""}`,
      res.sistemas   > 0 && `${res.sistemas} sistema${res.sistemas !== 1 ? "s" : ""}`,
      res.clientes   > 0 && `${res.clientes} cliente${res.clientes !== 1 ? "s" : ""}`,
      res.integracoes > 0 && `${res.integracoes} integração${res.integracoes !== 1 ? "ões" : ""}`,
      res.usuarios   > 0 && `${res.usuarios} usuário${res.usuarios !== 1 ? "s" : ""}`,
    ].filter(Boolean).join(", ")
    return `${total} registro${total !== 1 ? "s" : ""} removido${total !== 1 ? "s" : ""}: ${partes}.`
  }

  function handleClick() {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setConfirmando(false)
    startTransition(async () => {
      try {
        const res = await limparRegistrosInativos()
        toast.success(buildMessage(res))
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao limpar registros.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {!confirmando ? (
          <Button variant="outline" onClick={handleClick} disabled={isPending}>
            <Trash2 />
            {isPending ? "Limpando..." : "Limpar registros"}
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
          Atenção: esta ação é irreversível. Todos os sistemas, módulos, cenários, suítes, clientes e integrações serão removidos. Usuários inativos também serão excluídos. Usuários ativos serão mantidos.
        </p>
      )}
    </div>
  )
}
