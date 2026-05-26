// O dashboard gerencia o próprio estado de loading via SectionSpinner no cliente.
// Retornar null evita que o Suspense do Next.js exiba um fallback intermediário
// antes de o componente cliente assumir o controle.
export default function Loading() {
  return null
}
