"use client"

import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useRef } from "react"
import { Captcha, type CaptchaHandle } from "@/components/ui/captcha"

const meta: Meta<typeof Captcha> = {
  title: "UI/Captcha",
  component: Captcha,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Captcha de imagem renderizado via Canvas HTML5. Gera um código aleatório com distorção visual (linhas, pontos, rotação de caracteres). Expõe `isValid()` e `reset()` via ref.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof Captcha>

export const Default: Story = {}

export const WithError: Story = {
  args: {
    error: "Caracteres incorretos. Tente novamente.",
  },
}

export const CustomLabel: Story = {
  args: {
    label: "Verifique que você é humano",
    placeholder: "Informe os caracteres",
  },
}

export const WithRefActions: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ref = useRef<CaptchaHandle>(null)
    return (
      <div className="space-y-4 max-w-xs">
        <Captcha ref={ref} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => alert(`isValid: ${ref.current?.isValid()}`)}
            className="rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-primary hover:bg-neutral-grey-50"
          >
            Verificar
          </button>
          <button
            type="button"
            onClick={() => ref.current?.reset()}
            className="rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-primary hover:bg-neutral-grey-50"
          >
            Resetar
          </button>
        </div>
      </div>
    )
  },
}
