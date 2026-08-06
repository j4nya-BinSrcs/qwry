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

export function SkeletonRow({ count = 7 }) {
  return (
    <div className="space-y-0.5 px-1" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
          <Skeleton className="size-8 rounded shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-10 rounded-full shrink-0" />
            </div>
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonImageCard({ count = 7 }) {
  return (
    <div className="flex gap-3 px-3 pb-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-32 shrink-0">
          <Skeleton className="aspect-square rounded" />
          <Skeleton className="h-3 w-full mt-1.5" />
          <Skeleton className="h-3 w-2/3 mt-1" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonVideoCard({ count = 4 }) {
  return (
    <div className="flex gap-3 px-3 pb-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-56 shrink-0">
          <Skeleton className="aspect-video rounded" />
          <Skeleton className="h-3 w-full mt-1.5" />
          <Skeleton className="h-3 w-1/2 mt-1" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonNewsCard({ count = 3 }) {
  return (
    <div className="flex gap-3 px-3 pb-3 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 border border-border rounded p-2.5">
          <div className="flex items-start gap-2.5">
            <Skeleton className="size-10 rounded shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonDiscovery() {
  return (
    <div aria-hidden="true">
      <div className="px-3 py-2">
        <Skeleton className="h-3 w-24" />
      </div>
      <SkeletonImageCard />
      <div className="px-3 py-2">
        <Skeleton className="h-3 w-24" />
      </div>
      <SkeletonVideoCard />
      <div className="px-3 py-2">
        <Skeleton className="h-3 w-24" />
      </div>
      <SkeletonNewsCard />
    </div>
  );
}

export function SkeletonOverview() {
  return (
    <div className="rounded-xl border border-border bg-panel" aria-hidden="true">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="px-4 py-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <Skeleton className="h-7 w-24 rounded" />
        <Skeleton className="h-7 w-32 rounded" />
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
          className="w-full bg-panel border border-border rounded-lg overflow-hidden flex flex-col"
          style={{ gridRow: `span ${spans[i % spans.length]}` }}
        >
          <div className="flex-1 min-h-0 p-2.5">
            <Skeleton className="w-full h-full rounded-md" />
          </div>
          <div className="px-2 py-1.5 flex items-center justify-between gap-1.5">
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
        <div key={i} className="mb-3 bg-panel border border-border rounded-xl overflow-hidden break-inside-avoid">
          <Skeleton className={`${aspects[i % 3]} rounded-none`} />
          <div className="px-2.5 py-2.5 space-y-1.5">
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
