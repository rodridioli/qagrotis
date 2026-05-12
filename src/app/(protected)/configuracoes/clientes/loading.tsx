export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-10 w-full animate-pulse rounded-lg bg-neutral-grey-100" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-neutral-grey-100" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  )
}
