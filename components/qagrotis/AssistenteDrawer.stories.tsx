import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { AssistenteDrawer } from "@/components/qagrotis/AssistenteDrawer"
import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"
import { SistemaContext } from "@/lib/modulo-context"

const meta: Meta<typeof AssistenteDrawer> = {
  title: "QAgrotis/AssistenteDrawer",
  component: AssistenteDrawer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
Drawer lateral de chat com IA, contextual ao sistema selecionado.

### Funcionamento
1. O usuário abre o drawer clicando em "Assistente de IA" no menu lateral
2. Digita uma pergunta em linguagem natural
3. O backend busca conteúdo relevante no GitBook via RAG por palavras-chave
4. O modelo \`claude-haiku-4-5-20251001\` responde com base nesse contexto
5. A resposta é transmitida em streaming e renderizada em Markdown

### Props
| Prop | Tipo | Descrição |
|------|------|-----------|
| \`open\` | \`boolean\` | Controla se o drawer está aberto |
| \`onOpenChange\` | \`(open: boolean) => void\` | Callback de abertura/fechamento |

### Dependências
- Requer \`SistemaContext\` no contexto (fornecido pelo \`LayoutClient\`)
- Requer API route \`POST /api/assistente\` no servidor
- Requer \`ASSISTENTE_API_KEY\` ou \`ANTHROPIC_API_KEY\` no ambiente
- Requer \`GITBOOK_CONTENT_URL\` no ambiente (padrão: URL pública do Agrotis)

### Design tokens utilizados
- \`bg-brand-primary\` — avatar do assistente e balões do usuário
- \`border-border-default\` — separadores e bordas
- \`bg-surface-card\` — fundo do header e input
- \`text-text-primary / text-text-secondary\` — tipografia
- \`bg-destructive/10 text-destructive\` — estado de erro
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <SistemaContext.Provider
        value={{
          sistemaSelecionado: "Gerencial",
          setSistemaSelecionado: () => {},
        }}
      >
        <Story />
      </SistemaContext.Provider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AssistenteDrawer>

// ── Controlled wrapper ────────────────────────────────────────────────────────

function DrawerWithTrigger({ sistema = "Gerencial" }: { sistema?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <SistemaContext.Provider
      value={{ sistemaSelecionado: sistema, setSistemaSelecionado: () => {} }}
    >
      <div className="flex h-screen items-center justify-center bg-surface-default">
        <Button onClick={() => setOpen(true)}>
          <Bot className="size-4" />
          Abrir Assistente
        </Button>
        <AssistenteDrawer open={open} onOpenChange={setOpen} />
      </div>
    </SistemaContext.Provider>
  )
}

// ── Stories ───────────────────────────────────────────────────────────────────

export const PadraoFechado: Story = {
  name: "Padrão — fechado",
  parameters: {
    docs: {
      description: {
        story: "Estado inicial: drawer fechado. Clique em 'Abrir Assistente' para visualizar.",
      },
    },
  },
  render: () => <DrawerWithTrigger />,
}

export const Aberto: Story = {
  name: "Aberto — estado vazio",
  parameters: {
    docs: {
      description: {
        story:
          "Drawer aberto no estado vazio, exibindo a mensagem de boas-vindas e as sugestões de perguntas.",
      },
    },
  },
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <div className="relative h-screen bg-surface-default">
        <AssistenteDrawer open={open} onOpenChange={setOpen} />
      </div>
    )
  },
}

export const SistemaFinanceiro: Story = {
  name: "Contexto — módulo Financeiro",
  parameters: {
    docs: {
      description: {
        story:
          "O assistente exibe o módulo selecionado no header. As perguntas são contextualizadas automaticamente.",
      },
    },
  },
  render: () => <DrawerWithTrigger sistema="Financeiro" />,
}

export const SistemaAgricola: Story = {
  name: "Contexto — módulo Agrícola",
  parameters: {
    docs: {
      description: {
        story: "Drawer com módulo Agrícola selecionado.",
      },
    },
  },
  render: () => <DrawerWithTrigger sistema="Agrícola" />,
}
