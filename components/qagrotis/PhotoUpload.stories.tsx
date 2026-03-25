import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useState } from "react"
import { PhotoUpload } from "./PhotoUpload"

const meta: Meta<typeof PhotoUpload> = {
  title: "QAgrotis/PhotoUpload",
  component: PhotoUpload,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Campo de upload de foto de perfil. Exibe área de drop quando vazio e pré-visualização da imagem quando carregada. O botão de remoção usa `bg-destructive text-white` com `rounded-full`. Aceita PNG e JPG até 5 MB.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof PhotoUpload>

export const Vazio: Story = {
  name: "Vazio (sem foto)",
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [preview, setPreview] = useState<string | null>(null)
    return (
      <div className="w-64">
        <PhotoUpload
          preview={preview}
          onFileSelect={(file) => {
            const reader = new FileReader()
            reader.onload = (ev) => setPreview(ev.target?.result as string)
            reader.readAsDataURL(file)
          }}
          onRemove={() => setPreview(null)}
        />
      </div>
    )
  },
}

export const ComFoto: Story = {
  name: "Com foto carregada",
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [preview, setPreview] = useState<string | null>(
      "https://i.pravatar.cc/300?img=12"
    )
    return (
      <div className="w-64">
        <PhotoUpload
          preview={preview}
          onFileSelect={(file) => {
            const reader = new FileReader()
            reader.onload = (ev) => setPreview(ev.target?.result as string)
            reader.readAsDataURL(file)
          }}
          onRemove={() => setPreview(null)}
        />
      </div>
    )
  },
}

export const NoPainelDeEdicao: Story = {
  name: "No painel de edição",
  parameters: {
    docs: {
      description: {
        story:
          "Exibição dentro do card de perfil, como aparece nas páginas Novo Usuário e Editar Usuário.",
      },
    },
  },
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [preview, setPreview] = useState<string | null>(null)
    return (
      <div className="w-80 rounded-xl bg-surface-card p-5 shadow-card">
        <h2 className="mb-3 font-semibold text-text-primary">Foto de Perfil</h2>
        <PhotoUpload
          preview={preview}
          onFileSelect={(file) => {
            const reader = new FileReader()
            reader.onload = (ev) => setPreview(ev.target?.result as string)
            reader.readAsDataURL(file)
          }}
          onRemove={() => setPreview(null)}
        />
      </div>
    )
  },
}
