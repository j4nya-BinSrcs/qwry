import { Hash, Image, Youtube, Maximize2, Minimize2, Newspaper, ExternalLink, BookOpen, Sparkles, Plus, Check, GripVertical, Loader2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSearchStore } from "../stores/searchStore";
import { useUIStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import InfoBoxCard from "../components/InfoBoxCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
];

function MultiRowScroll({ children, rows = 3 }) {
  const scrollRef = useRef(null);
  const items = Array.isArray(children) ? children : [children];
  const cols = Math.ceil(items.length / rows);
  const grid = Array.from({ length: cols }, (_, c) =>
    items.slice(c * rows, c * rows + rows)
  );
  return (
    <div ref={scrollRef} className="overflow-x-auto scrollbar-none">
      <div className="grid grid-flow-col gap-3 px-3 pb-3" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {grid.flat().map((child, i) => (
          <div key={i} className="contents">{child}</div>
        ))}
      </div>
    </div>
  );
}

function LoadMoreButton({ loading, hasMore, onClick }) {
  if (!hasMore) return null;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-text hover:bg-hover hover:border-text transition-all disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          Loading...
        </>
      ) : (
        "Load more"
      )}
    </button>
  );
}

function DraggableImageCard({ result }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-img-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const imgSrc = result.img_src || result.thumbnail;
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const openReader = useUIStore((s) => s.openReader);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    if (!activeWsId || saved) return;
    addItem(sessionId, activeWsId, result.url, result.title, result.snippet, result.source, imgSrc);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [sessionId, activeWsId, result, addItem, saved, imgSrc]);

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex-shrink-0 w-32 cursor-default ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="relative rounded overflow-hidden bg-hover border border-border hover:border-text transition-all">
        <div className="aspect-square">
          {imgSrc ? (
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
              alt="" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dim text-[10px]">No image</div>
          )}
        </div>
        <div className="absolute inset-0 bg-text/0 group-hover:bg-text/30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
          <button {...listeners} className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors cursor-grab active:cursor-grabbing">
            <GripVertical size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openReader(result.url, result.title, imgSrc); }}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors" title="Reader"
          >
            <BookOpen size={13} />
          </button>
          <button onClick={handleSave} disabled={!activeWsId}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors disabled:opacity-30" title="Save"
          >
            {saved ? <Check size={13} /> : <Plus size={13} />}
          </button>
          <button onClick={() => window.open(result.url, "_blank")}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors" title="Open"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
      <div className="mt-1 px-0.5">
        <div className="text-[11px] text-text font-medium leading-tight line-clamp-2">{result.title}</div>
        <div className="text-[10px] text-dim truncate mt-0.5">{result.engine || result.source || result.category}</div>
      </div>
    </div>
  );
}

function DraggableVideoCard({ result }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-vid-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const imgSrc = result.img_src || result.thumbnail;
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const openReader = useUIStore((s) => s.openReader);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    if (!activeWsId || saved) return;
    addItem(sessionId, activeWsId, result.url, result.title, result.snippet, result.source, imgSrc);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [sessionId, activeWsId, result, addItem, saved, imgSrc]);

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex-shrink-0 w-56 cursor-default ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="relative rounded overflow-hidden bg-hover border border-border hover:border-text transition-all">
        <div className="aspect-video">
          {imgSrc ? (
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
              alt="" className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dim text-[10px]">No thumbnail</div>
          )}
        </div>
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-text/70 text-[10px] text-surface font-medium">
          {result.published_date || result.engine || "Video"}
        </div>
        <div className="absolute inset-0 bg-text/0 group-hover:bg-text/30 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
          <button {...listeners} className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors cursor-grab active:cursor-grabbing">
            <GripVertical size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); openReader(result.url, result.title, imgSrc); }}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors" title="Reader"
          >
            <BookOpen size={13} />
          </button>
          <button onClick={handleSave} disabled={!activeWsId}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors disabled:opacity-30" title="Save"
          >
            {saved ? <Check size={13} /> : <Plus size={13} />}
          </button>
          <button onClick={() => window.open(result.url, "_blank")}
            className="p-1.5 rounded bg-text/50 text-surface hover:bg-text/70 transition-colors" title="Open"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>
      <div className="mt-1 px-0.5">
        <div className="text-[11px] text-text font-medium leading-tight line-clamp-2">{result.title}</div>
        <div className="text-[10px] text-dim truncate mt-0.5">{result.engine || result.source || result.category}</div>
      </div>
    </div>
  );
}

function DraggableNewsCard({ result }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-news-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const imgSrc = result.img_src || result.thumbnail;
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback((e) => {
    e.stopPropagation();
    if (!activeWsId || saved) return;
    addItem(sessionId, activeWsId, result.url, result.title, result.snippet, result.source, imgSrc);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [sessionId, activeWsId, result, addItem, saved, imgSrc]);

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex-shrink-0 w-72 rounded border border-border hover:border-text transition-all cursor-default ${isDragging ? "opacity-50" : "hover:bg-hover"}`}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        {imgSrc ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
            alt="" className="size-10 rounded object-cover shrink-0"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="size-10 rounded bg-hover shrink-0 flex items-center justify-center text-dim text-[10px]">No img</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text leading-snug line-clamp-2">
            {result.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-dim truncate">
              {result.engine || result.source || result.category}
            </span>
            {result.published_date && (
              <>
                <span className="text-dim text-[10px]">·</span>
                <span className="text-[10px] text-dim shrink-0">{result.published_date}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 px-2.5 pb-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
        <button {...listeners} className="p-1 rounded text-dim cursor-grab active:cursor-grabbing hover:text-text hover:bg-hover transition-all">
          <GripVertical size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); openReader(result.url, result.title, imgSrc); }}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Reader"
        >
          <BookOpen size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); openSummarizer(result.url, result.title); }}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Summarize"
        >
          <Sparkles size={11} />
        </button>
        <button onClick={handleSave} disabled={!activeWsId}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all disabled:opacity-30" title="Save"
        >
          {saved ? <Check size={11} /> : <Plus size={11} />}
        </button>
        <button onClick={() => window.open(result.url, "_blank")}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Open"
        >
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);
  const imageResults = useSearchStore((s) => s.imageResults);
  const videoResults = useSearchStore((s) => s.videoResults);
  const newsResults = useSearchStore((s) => s.newsResults);
  const infobox = useSearchStore((s) => s.infobox);
  const loadMoreImages = useSearchStore((s) => s.loadMoreImages);
  const loadMoreVideos = useSearchStore((s) => s.loadMoreVideos);
  const loadMoreNews = useSearchStore((s) => s.loadMoreNews);
  const loading = useSearchStore((s) => s.loading);
  const hasMoreImages = useSearchStore((s) => s.hasMoreImages);
  const hasMoreVideos = useSearchStore((s) => s.hasMoreVideos);
  const hasMoreNews = useSearchStore((s) => s.hasMoreNews);
  const [activeFilter, setActiveFilter] = useState("all");
  const expandedPanel = useUIStore((s) => s.expandedPanel);
  const toggleExpand = useUIStore((s) => s.toggleExpand);
  const isExpanded = expandedPanel === "discovery";

  const hasContent = query && (
    infobox || imageResults.length > 0 || videoResults.length > 0 ||
    newsResults.length > 0
  );

  const showAll = activeFilter === "all";

  return (
    <div className="h-full flex flex-col">
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
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`shrink-0 px-2.5 py-1 text-xs rounded-md transition-colors ${
                activeFilter === f.id
                  ? "bg-text text-surface font-medium"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

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
            {(showAll || activeFilter === "all") && infobox && (
              <div className="border-t border-border">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                  <Hash size={13} />
                  <span>Overview</span>
                </div>
                <div className="px-3 pb-2">
                  <InfoBoxCard infobox={infobox} />
                </div>
              </div>
            )}

            {(showAll || activeFilter === "images") && imageResults.length > 0 && (
              <div className="border-t border-border">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider">
                    <Image size={13} />
                    <span>Images</span>
                    <span className="text-dim font-normal">{imageResults.length}</span>
                  </div>
                  <LoadMoreButton
                    loading={loading}
                    hasMore={hasMoreImages}
                    onClick={loadMoreImages}
                  />
                </div>
                <MultiRowScroll rows={3}>
                  {imageResults.map((r, i) => (
                    <DraggableImageCard key={`img-${r.url}-${i}`} result={r} />
                  ))}
                </MultiRowScroll>
              </div>
            )}

            {(showAll || activeFilter === "videos") && videoResults.length > 0 && (
              <div className="border-t border-border">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider">
                    <Youtube size={13} />
                    <span>Videos</span>
                    <span className="text-dim font-normal">{videoResults.length}</span>
                  </div>
                  <LoadMoreButton
                    loading={loading}
                    hasMore={hasMoreVideos}
                    onClick={loadMoreVideos}
                  />
                </div>
                <MultiRowScroll rows={3}>
                  {videoResults.map((r, i) => (
                    <DraggableVideoCard key={`vid-${r.url}-${i}`} result={r} />
                  ))}
                </MultiRowScroll>
              </div>
            )}

            {(showAll || activeFilter === "news") && newsResults.length > 0 && (
              <div className="border-t border-border">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider">
                    <Newspaper size={13} />
                    <span>News</span>
                    <span className="text-dim font-normal">{newsResults.length}</span>
                  </div>
                  <LoadMoreButton
                    loading={loading}
                    hasMore={hasMoreNews}
                    onClick={loadMoreNews}
                  />
                </div>
                <MultiRowScroll rows={3}>
                  {newsResults.map((r, i) => (
                    <DraggableNewsCard key={`news-${r.url}-${i}`} result={r} />
                  ))}
                </MultiRowScroll>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
