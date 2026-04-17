export default function Loading() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-14 w-full animate-pulse rounded-xl bg-neutral-grey-100"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}
