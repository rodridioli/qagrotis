import { Sparkles } from "lucide-react"

export default function GeradorPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-brand-primary/10">
        <Sparkles className="size-8 text-brand-primary" />
      </div>
      <h2 className="text-xl font-semibold text-text-primary">Gerador</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">
        Funcionalidade em desenvolvimento. Em breve você poderá gerar cenários BDD com inteligência artificial.
      </p>
    </div>
  )
}
