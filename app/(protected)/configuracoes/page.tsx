import Link from "next/link"
import { Users, Monitor, Box } from "lucide-react"

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-text-primary">Configurações</h2>
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <Link
          href="/configuracoes/usuarios"
          className="flex flex-col items-center gap-3 rounded-xl bg-primary-50 p-8 shadow-card transition-colors hover:bg-primary-100"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-brand-primary">
            <Users className="size-6" />
          </div>
          <span className="font-semibold text-text-primary">Usuários</span>
        </Link>

        <div className="flex flex-col items-center gap-3 rounded-xl bg-neutral-grey-50 p-8 shadow-card opacity-60 cursor-not-allowed">
          <div className="flex size-12 items-center justify-center rounded-full bg-neutral-grey-100 text-text-secondary">
            <Monitor className="size-6" />
          </div>
          <span className="font-semibold text-text-secondary">Sistemas</span>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-xl bg-neutral-grey-50 p-8 shadow-card opacity-60 cursor-not-allowed">
          <div className="flex size-12 items-center justify-center rounded-full bg-neutral-grey-100 text-text-secondary">
            <Box className="size-6" />
          </div>
          <span className="font-semibold text-text-secondary">Módulos</span>
        </div>
      </div>
    </div>
  )
}
