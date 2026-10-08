/** Shimmering placeholders, shaped like the rows they stand in for. */
export function SkeletonRow({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-surface px-3 ${tall ? 'h-[68px]' : 'h-[60px]'}`} aria-hidden="true">
      <span className="skeleton h-9 w-9 rounded-full" />
      <span className="flex flex-1 flex-col gap-2">
        <span className="skeleton h-3.5 w-2/5" />
        <span className="skeleton h-3 w-3/5" />
      </span>
      <span className="skeleton h-3.5 w-16" />
    </div>
  );
}

export function SkeletonLine({ className = 'h-4 w-24' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}
