interface SkeletonProps {
  height?: number | string
  width?: number | string
  className?: string
}

export function Skeleton({ height = 16, width = '100%', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ height, width }}
      role="status"
      aria-label="Loading…"
    />
  )
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={14} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${60 + Math.random() * 30}%`} />
      ))}
    </div>
  )
}
