import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { LoginForm } from "@/components/forms/LoginForm"
import { QAgrotisLogo } from "@/components/qagrotis/QAgrotisLogo"

const meta: Meta<typeof LoginForm> = {
  title: "QAgrotis/LoginForm",
  component: LoginForm,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Formulário de autenticação do QAgrotis com dois modos:

- **Login** — e-mail + senha com toggle de visibilidade, CAPTCHA por imagem (canvas), botão "Entrar" e login com Google (OAuth).
- **Recuperação de senha** — apenas e-mail; chama \`POST /api/forgot-password\` via Resend.

**Tokens usados:** \`bg-brand-primary\`, \`bg-surface-card\`, \`bg-surface-input\`, \`border-border-default\`, \`text-text-primary\`, \`text-text-secondary\`, \`rounded-custom\`, \`text-destructive\`.

**Credenciais de protótipo:** \`rodridioli@gmail.com\` / \`admin\`.
        `.trim(),
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof LoginForm>

const CardDecorator = (Story: React.ComponentType) => (
  <div className="w-[384px] rounded-2xl bg-surface-card px-8 py-10 shadow-card space-y-6">
    <div className="flex flex-col items-center gap-1 text-center">
      <QAgrotisLogo height={32} />
      <p className="mt-1 text-sm text-text-secondary">Gestão de Qualidade de Software</p>
    </div>
    <Story />
  </div>
)

export const Login: Story = {
  name: "Modo login",
  decorators: [CardDecorator],
}

export const FullPage: Story = {
  name: "Tela completa",
  render: () => (
    <div className="flex min-h-screen w-screen items-center justify-center bg-surface-default px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-surface-card px-8 py-10 shadow-card space-y-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <QAgrotisLogo height={32} />
            <p className="mt-1 text-sm text-text-secondary">Gestão de Qualidade de Software</p>
          </div>
          <LoginForm callbackUrl="/dashboard" />
        </div>
      </div>
    </div>
  ),
  parameters: { layout: "fullscreen" },
}
