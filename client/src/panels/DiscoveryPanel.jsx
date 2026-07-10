import { ChevronDown, ChevronRight, Hash, Image, Youtube } from "lucide-react";
import { useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import InfoBoxCard from "../components/InfoBoxCard";
import MediaCard from "../components/MediaCard";

function CollapsibleSection({ title, icon: Icon, children, defaultOpen, count }) {
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
        {count != null && (
          <span className="text-dim font-normal">{count}</span>
        )}
      </button>
      {open && children}
    </div>
  );
}

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const suggestions = useSearchStore((s) => s.suggestions);
  const infobox = useSearchStore((s) => s.infobox);
  const search = useSearchStore((s) => s.search);

  const imageResults = results.filter((r) => r.category === "images" && r.img_src);
  const videoResults = results.filter((r) => r.category === "videos" || r.category === "news");

  return (
    <div className="h-full flex flex-col bg-panel border-l border-border">
      <div className="shrink-0 px-3 py-2.5 border-b border-border">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Discovery
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {!query ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Search to see related content here
          </div>
        ) : (
          <>
            {infobox && (
              <CollapsibleSection title="Overview" icon={Hash} defaultOpen={false}>
                <InfoBoxCard infobox={infobox} />
              </CollapsibleSection>
            )}

            {imageResults.length > 0 && (
              <CollapsibleSection title="Images" icon={Image} count={imageResults.length}>
                <div className="px-3 pb-2 space-y-0.5">
                  {imageResults.map((r, i) => (
                    <MediaCard key={`img-${r.url}-${i}`} result={r} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {videoResults.length > 0 && (
              <CollapsibleSection title="Videos & News" icon={Youtube} count={videoResults.length}>
                <div className="px-3 pb-2 space-y-0.5">
                  {videoResults.map((r, i) => (
                    <MediaCard key={`vid-${r.url}-${i}`} result={r} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {suggestions.length > 0 && (
              <CollapsibleSection title="Related Searches" count={suggestions.length}>
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => search(s)}
                      className="px-2.5 py-1 text-xs rounded-full bg-hover text-muted border border-border hover:text-text hover:border-accent/30 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {!infobox && imageResults.length === 0 && videoResults.length === 0 && suggestions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                No additional content found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}