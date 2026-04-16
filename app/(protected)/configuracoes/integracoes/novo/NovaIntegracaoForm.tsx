"use client"

import React, { useState, useTransition, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select"
import { criarIntegracao } from "@/lib/actions/integracoes"
import { toast } from "sonner"


const MAX_DESCRICAO = 200

type KeyStatus = "idle" | "validating" | "valid" | "invalid" | "uncertain"

export default function NovaIntegracaoForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [provider, setProvider] = useState("OpenRouter")

  const [model, setModel] = useState("google/gemini-2.0-flash-exp:free")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)

  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle")

  const validateKey = useCallback(async () => {
    if (!apiKey.trim()) { toast.error("Digite a API Key antes de verificar."); return }
    setKeyStatus("validating")
    try {
      const res = await fetch("/api/integracoes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider }),
      })
      if (res.ok) setKeyStatus("valid")
      else if (res.status === 401) setKeyStatus("invalid")
      else setKeyStatus("uncertain")
    } catch {
      setKeyStatus("uncertain")
    }
  }, [apiKey])

  function handleApiKeyChange(value: string) {
    setApiKey(value)
    setKeyStatus("idle")
  }

  function handleSave() {
    if (!apiKey.trim()) { toast.error("A API Key é obrigatória."); return }
    if (keyStatus === "validating") { toast.error("Aguarde a validação da API Key."); return }

    startTransition(async () => {
      try {
        await criarIntegracao({
          provider,
          model: model.trim(),
          apiKey: apiKey.trim()
        })

        toast.success("Integração criada com sucesso.")
        router.push("/configuracoes/integracoes")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar")
      }
    })
  }

  const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProvider(e.target.value)
  }


  const statusIcon: Record<KeyStatus, React.ReactNode> = {
    idle:       null,
    validating: <Loader2 className="size-4 animate-spin text-text-secondary" />,
    valid:      <Check className="size-4 text-green-600" />,
    invalid:    <AlertCircle className="size-4 text-destructive" />,
    uncertain:  <AlertCircle className="size-4 text-amber-500" />,
  }

  const isSaveDisabled = isPending || keyStatus === "validating"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href="/configuracoes/integracoes"
            title="Voltar"
            aria-label="Voltar"
            className="flex size-8 items-center justify-center rounded-xs text-text-secondary transition-colors hover:bg-neutral-grey-100 hover:text-brand-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/configuracoes" className="text-text-secondary hover:text-brand-primary">
            Configurações
          </Link>
          <span className="text-text-secondary">/</span>
          <Link href="/configuracoes/integracoes" className="text-text-secondary hover:text-brand-primary">
            Modelos de IA
          </Link>
          <span className="text-text-secondary">/</span>
          <span className="font-medium text-text-primary">Nova Integração</span>
        </div>
        <Button onClick={handleSave} disabled={isSaveDisabled}>
          <Check className="size-4" />
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="max-w-2xl space-y-4 rounded-xl bg-surface-card p-5 shadow-card">


        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Provedor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Provedor <span className="text-destructive">*</span>
            </label>
            <Input
              value={provider}
              onChange={handleProviderChange}
              placeholder="Ex.: OpenRouter, OpenAI, Groq..."
              disabled={isPending}
            />
          </div>

          {/* Modelo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Modelo <span className="text-destructive">*</span>
            </label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ex.: gemini-2.0-flash, llama-3.1-70b..."
              disabled={isPending}
            />
            {provider.toLowerCase().includes("openrouter") && (
              <p className="text-[10px] text-text-secondary">
                Com visão (recomendado): <span className="font-medium">google/gemini-2.0-flash-exp:free</span> · meta-llama/llama-3.2-11b-vision-instruct:free<br />
                Apenas texto: meta-llama/llama-3.1-8b-instruct:free · mistralai/mistral-7b-instruct:free · google/gemma-2-9b-it:free
              </p>
            )}
            {provider.toLowerCase().includes("groq") && (
              <p className="text-[10px] text-text-secondary">Sugestão: llama-3.1-70b-versatile, llama-3.1-8b-instant</p>
            )}
            {provider.toLowerCase().includes("google") && (
              <p className="text-[10px] text-text-secondary">Sugestão: gemini-2.0-flash-exp, gemini-1.5-flash</p>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-primary">
            API Key <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center gap-2">
            {/* Input com ícone de visibilidade e status dentro */}
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Cole aqui a sua API Key..."
                className="pr-16"
                disabled={isPending}
              />
              <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
                {statusIcon[keyStatus]}
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  aria-label={showKey ? "Ocultar chave" : "Exibir chave"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Botão de verificar conexão */}
            <button
              type="button"
              onClick={validateKey}
              disabled={keyStatus === "validating" || !apiKey.trim() || isPending}
              title="Verificar conexão com a API"
              aria-label="Verificar conexão com a API"
              className="flex size-10 shrink-0 items-center justify-center rounded-custom border border-border-default bg-surface-input text-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary disabled:pointer-events-none disabled:opacity-40"
            >
              <ShieldCheck className="size-4" />
            </button>
          </div>

          <p className={`text-xs ${
            keyStatus === "valid"     ? "text-green-600" :
            keyStatus === "invalid"   ? "text-destructive" :
            keyStatus === "uncertain" ? "text-amber-600" :
            "text-text-secondary"
          }`}>
            {keyStatus === "idle"       && "Clique no ícone de escudo para verificar a conexão."}
            {keyStatus === "validating" && "Verificando conexão com a API…"}
            {keyStatus === "valid"      && "Chave válida — conexão com a API confirmada."}
            {keyStatus === "invalid"    && "Chave inválida — verifique se copiou corretamente."}
            {keyStatus === "uncertain"  && "Não foi possível confirmar agora (quota ou região). Você pode salvar assim mesmo."}
          </p>
        </div>
      </div>
    </div>
  )
}
