export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-card" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-14 w-full animate-pulse rounded-xl bg-surface-card"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}
