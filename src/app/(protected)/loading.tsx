import { SectionSpinner } from "@/components/shared/SectionSpinner"

// Suspense fallback padrão para todas as rotas da área protegida que não
// possuem loading.tsx próprio. Renderiza dentro do layout (sidebar visível).
export default function ProtectedLoading() {
  return <SectionSpinner minHeight="min-h-[400px]" label="Carregando…" />
}
