export default function Skeleton({ className = "", style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 4, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonRow({ count = 6 }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-xl bg-elevated shadow-surface">
          <Skeleton className="size-11 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-3.5 w-3/4" />
            <div className="flex items-center gap-2 mt-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <Skeleton className="h-3 w-full mt-2.5" />
            <Skeleton className="h-3 w-5/6 mt-1.5" />
            <Skeleton className="h-3 w-2/3 mt-1.5" />
            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/60">
              <Skeleton className="h-4 w-14 rounded-md" />
              <Skeleton className="h-4 w-14 rounded-md" />
              <Skeleton className="h-4 w-14 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonImageCard({ count = 6 }) {
  return (
    <div className="columns-2 gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`${i === 0 ? "aspect-[4/5]" : "aspect-square"} rounded-xl mb-3`} />
      ))}
    </div>
  );
}

export function SkeletonVideoCard({ count = 4 }) {
  return (
    <div className="columns-2 gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-3">
          <Skeleton className="aspect-video rounded-xl" />
          <Skeleton className="h-3 w-3/4 mt-2.5" />
          <Skeleton className="h-3 w-1/2 mt-1.5" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonNewsCard({ count = 3 }) {
  return (
    <div className="space-y-1.5 px-0.5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-xl">
          <Skeleton className="size-11 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonDiscovery() {
  return (
    <div aria-hidden="true">
      <div className="px-1 pt-5 pb-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <SkeletonImageCard />
      <div className="px-1 pt-5 pb-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <SkeletonVideoCard />
      <div className="px-1 pt-5 pb-3">
        <Skeleton className="h-4 w-24" />
      </div>
      <SkeletonNewsCard />
    </div>
  );
}

export function SkeletonOverview() {
  return (
    <div className="rounded-2xl bg-elevated shadow-raised" aria-hidden="true">
      <div className="flex items-start gap-3.5 px-5 pt-5 pb-3">
        <Skeleton className="size-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="px-5 space-y-2.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex items-center gap-2 px-5 py-3.5 mt-3 border-t border-border/60">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-lg ml-auto" />
      </div>
    </div>
  );
}

export function SkeletonWsCard({ count = 6 }) {
  const spans = [9, 12, 10, 13, 11, 9];
  return (
    <div className="ws-grid gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-full bg-elevated border border-border rounded-lg overflow-hidden flex flex-col"
          style={{ gridRow: `span ${spans[i % spans.length]}` }}
        >
          <div className="flex-1 min-h-0 p-3">
            <Skeleton className="w-full h-full rounded-md" />
          </div>
          <div className="px-2 py-2 flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="size-5 rounded-md shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTallCard({ count = 6 }) {
  const aspects = ["aspect-square", "aspect-video", "aspect-[4/3]"];
  return (
    <div className="columns-2 xl:columns-3 gap-3 px-3 py-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-3 bg-elevated rounded-xl shadow-raised overflow-hidden break-inside-avoid">
          <Skeleton className={`${aspects[i % 3]} rounded-none`} />
          <div className="px-3 py-3 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonArticle() {
  return (
    <div className="space-y-2 py-2" aria-hidden="true">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
