import { ChevronDown, ChevronRight, Hash, Image, Youtube, Maximize2, Minimize2, ShoppingBag, Newspaper } from "lucide-react";
import { useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useUIStore } from "../stores/uiStore";
import InfoBoxCard from "../components/InfoBoxCard";
import MediaCard from "../components/MediaCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
  { id: "shopping", label: "Shopping" },
  { id: "related", label: "Related" },
];

function SectionHeader({ title, icon: Icon, count, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider hover:text-text transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {Icon && <Icon size={13} />}
        <span>{title}</span>
        {count != null && <span className="text-dim font-normal">{count}</span>}
      </button>
      {open && children}
    </div>
  );
}

function HorizontalScroll({ children, className = "" }) {
  return (
    <div className={`overflow-x-auto scrollbar-none ${className}`}>
      <div className="flex gap-2 px-3 pb-2 min-w-min">
        {children}
      </div>
    </div>
  );
}

function ImageCard({ result }) {
  const imgSrc = result.img_src || result.thumbnail;
  return (
    <div className="group flex-shrink-0 w-28">
      <MediaCard result={result} compact />
    </div>
  );
}

function VideoCard({ result }) {
  return (
    <div className="group flex-shrink-0 w-52">
      <MediaCard result={result} compact />
    </div>
  );
}

function NewsCard({ result }) {
  return (
    <div className="group flex-shrink-0 w-64">
      <div className="flex items-start gap-2 p-2 rounded border border-transparent hover:bg-hover hover:border-border transition-all cursor-default">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text line-clamp-2 leading-snug">
            {result.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {result.img_src && (
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(result.img_src)}`}
                alt="" className="size-4 rounded object-cover"
                onError={(e) => (e.target.style.display = "none")}
              />
            )}
            <span className="text-[10px] text-dim truncate">
              {result.engine || result.source || result.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShoppingCard({ result }) {
  return (
    <div className="group flex-shrink-0 w-36">
      <div className="rounded border border-border overflow-hidden hover:border-accent/30 transition-all cursor-default">
        {result.img_src && (
          <div className="aspect-square bg-hover overflow-hidden">
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(result.img_src)}`}
              alt="" className="w-full h-full object-cover"
              onError={(e) => (e.target.style.display = "none")}
            />
          </div>
        )}
        <div className="p-1.5">
          <div className="text-[10px] text-text line-clamp-2 leading-snug font-medium">
            {result.title}
          </div>
          <div className="text-[10px] text-accent font-semibold mt-0.5">
            {result.engine || result.source || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

function RelatedAccordion({ suggestions }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="px-3 pb-2 space-y-0.5">
      {suggestions.map((s, i) => (
        <div key={i} className="rounded border border-border overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-text hover:bg-hover transition-colors"
          >
            {openIndex === i ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            <span className="truncate">{s}</span>
          </button>
          {openIndex === i && (
            <div className="px-2.5 pb-2">
              <p className="text-[10px] text-muted leading-relaxed">
                Search for &ldquo;{s}&rdquo; to see related results.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);
  const imageResults = useSearchStore((s) => s.imageResults);
  const videoResults = useSearchStore((s) => s.videoResults);
  const suggestions = useSearchStore((s) => s.suggestions);
  const infobox = useSearchStore((s) => s.infobox);
  const search = useSearchStore((s) => s.search);
  const results = useSearchStore((s) => s.results);
  const [activeFilter, setActiveFilter] = useState("all");
  const expandedPanel = useUIStore((s) => s.expandedPanel);
  const toggleExpand = useUIStore((s) => s.toggleExpand);
  const isExpanded = expandedPanel === "discovery";

  // Extract news-like and shopping-like results from main results
  const newsResults = results.filter((r) =>
    r.category === "news" || r.category === "general"
  ).slice(0, 10);

  const shoppingResults = results.filter((r) =>
    r.category?.includes("shop") || r.source?.includes("shop")
  ).slice(0, 8);

  const hasContent = query && (
    infobox || imageResults.length > 0 || videoResults.length > 0 ||
    newsResults.length > 0 || shoppingResults.length > 0 ||
    suggestions.length > 0
  );

  const showAll = activeFilter === "all";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Discovery
          </h2>
          <button
            onClick={() => toggleExpand("discovery")}
            className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
        {/* Filter nav */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 px-2.5 py-1 text-xs rounded-md transition-colors ${
                activeFilter === f.id
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {!query ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Search to see related content here
          </div>
        ) : !hasContent ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No additional content found
          </div>
        ) : (
          <>
            {/* Overview */}
            {(showAll || activeFilter === "all") && infobox && (
              <SectionHeader title="Overview" icon={Hash}>
                <div className="px-3 pb-2">
                  <InfoBoxCard infobox={infobox} />
                </div>
              </SectionHeader>
            )}

            {/* Images */}
            {(showAll || activeFilter === "images") && imageResults.length > 0 && (
              <div className="border-t border-border">
                <SectionHeader title="Images" icon={Image} count={imageResults.length}>
                  <HorizontalScroll>
                    {imageResults.map((r, i) => (
                      <div key={`img-${r.url}-${i}`} className="flex-shrink-0">
                        <MediaCard result={r} compact />
                      </div>
                    ))}
                  </HorizontalScroll>
                </SectionHeader>
              </div>
            )}

            {/* Videos */}
            {(showAll || activeFilter === "videos") && videoResults.length > 0 && (
              <div className="border-t border-border">
                <SectionHeader title="Videos" icon={Youtube} count={videoResults.length}>
                  <HorizontalScroll>
                    {videoResults.map((r, i) => (
                      <div key={`vid-${r.url}-${i}`} className="flex-shrink-0">
                        <MediaCard result={r} compact />
                      </div>
                    ))}
                  </HorizontalScroll>
                </SectionHeader>
              </div>
            )}

            {/* News */}
            {(showAll || activeFilter === "news") && newsResults.length > 0 && (
              <div className="border-t border-border">
                <SectionHeader title="News" icon={Newspaper} count={newsResults.length}>
                  <HorizontalScroll>
                    {newsResults.map((r, i) => (
                      <NewsCard key={`news-${r.url}-${i}`} result={r} />
                    ))}
                  </HorizontalScroll>
                </SectionHeader>
              </div>
            )}

            {/* Shopping */}
            {(showAll || activeFilter === "shopping") && shoppingResults.length > 0 && (
              <div className="border-t border-border">
                <SectionHeader title="Shopping" icon={ShoppingBag} count={shoppingResults.length}>
                  <HorizontalScroll>
                    {shoppingResults.map((r, i) => (
                      <ShoppingCard key={`shop-${r.url}-${i}`} result={r} />
                    ))}
                  </HorizontalScroll>
                </SectionHeader>
              </div>
            )}

            {/* Related */}
            {(showAll || activeFilter === "related") && suggestions.length > 0 && (
              <div className="border-t border-border">
                <SectionHeader title="Related Searches" count={suggestions.length}>
                  <RelatedAccordion suggestions={suggestions} />
                </SectionHeader>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
