export default function ProtectedLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-default">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
        <span className="text-sm text-text-secondary">Carregando...</span>
      </div>
    </div>
  )
}
