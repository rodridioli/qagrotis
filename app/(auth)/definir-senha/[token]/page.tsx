"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"
import { definirSenha } from "@/lib/actions/invite-tokens"
import { toast } from "sonner"

export default function DefinirSenhaPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleSubmit() {
    if (!password) {
      toast.error("A senha é obrigatória.")
      return
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    startTransition(async () => {
      const result = await definirSenha(params.token, password)
      if (!result.ok) {
        toast.error(result.reason)
        return
      }
      toast.success("Senha definida com sucesso!")
      router.push("/login")
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-default px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-surface-card px-8 py-10 shadow-card space-y-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <QAgrotisLogo height={32} />
            <p className="mt-1 text-sm text-text-secondary">Gestão de Qualidade de Software</p>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-lg font-semibold text-text-primary">Defina sua senha</h1>
            <p className="text-sm text-text-secondary">Crie uma senha para acessar o sistema.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Nova senha</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Confirmar senha</label>
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-text-primary"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isPending}>
              <Check className="size-4" />
              {isPending ? "Salvando…" : "Definir senha"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
