"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Não foi possível iniciar o login com Google.",
  OAuthCallback: "Erro ao processar o retorno do Google.",
  OAuthCreateAccount: "Não foi possível criar a conta com Google.",
  OAuthAccountNotLinked: "Este e-mail já está cadastrado com outro método de login.",
  AccessDenied: "Acesso negado.",
  Configuration: "Erro de configuração do servidor.",
  UnauthorizedDomain: "Acesso não permitido. Apenas usuários cadastrados ou com e-mail @agrotis.com podem entrar com o Google.",
  GoogleInactive: "Usuário inativo. Entre em contato com o administrador do sistema.",
  Default: "Ocorreu um erro ao autenticar. Tente novamente.",
}

export function AuthErrorToast() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  useEffect(() => {
    if (!error) return
    const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default
    toast.error(message)
  }, [error])

  return null
}
