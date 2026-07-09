import { ChevronDown, ChevronRight, Image, Youtube } from "lucide-react";
import { useState } from "react";
import { useSearchStore } from "../stores/searchStore";

function CollapsibleSection({ title, icon: Icon, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider hover:text-text transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {Icon && <Icon size={13} />}
        <span>{title}</span>
      </button>
      {open && children}
    </div>
  );
}

function WidgetPlaceholder({ label, count = 4 }) {
  return (
    <div className="px-3 pb-2 space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-elevated/50 border border-border/50"
        >
          <div className="size-6 rounded bg-hover flex items-center justify-center text-dim">
            <Image size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-2.5 w-3/4 rounded bg-hover" />
            <div className="h-2 w-1/2 rounded bg-hover/50 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);

  return (
    <div className="h-full flex flex-col bg-panel border-l border-border">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Discovery
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {!query ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Search to see related content here
          </div>
        ) : (
          <>
            <CollapsibleSection title="Images" icon={Image}>
              <WidgetPlaceholder label="images" count={3} />
            </CollapsibleSection>
            <CollapsibleSection title="Videos" icon={Youtube}>
              <WidgetPlaceholder label="videos" count={2} />
            </CollapsibleSection>
            <CollapsibleSection title="Related Searches" default={false}>
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {["more about " + query, query + " guide", "best " + query].map(
                  (s, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-full bg-hover text-muted border border-border hover:text-text transition-colors cursor-pointer"
                    >
                      {s}
                    </span>
                  )
                )}
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}