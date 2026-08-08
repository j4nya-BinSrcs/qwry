import { Image, Youtube, Maximize2, Minimize2, Newspaper, ExternalLink, BookOpen, Sparkles, Plus, Check, GripVertical, Loader2, Play } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSearchStore } from "../stores/searchStore";
import { useUIStore } from "../stores/uiStore";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { SkeletonDiscovery } from "../components/Skeleton";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "news", label: "News" },
];

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function Favicon({ domain }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className="size-3 rounded-sm shrink-0"
      onError={(e) => (e.target.style.display = "none")}
    />
  );
}

function formatDuration(result) {
  const raw = result?.length_seconds ?? result?.duration_secs;
  const secs = Number(raw);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function resultThumb(result) {
  return result.img_src || result.thumbnail || "";
}

function LoadMoreButton({ loading, hasMore, onClick }) {
  if (!hasMore) return null;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md text-muted hover:text-text hover:bg-hover transition-colors disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Loading...
        </>
      ) : (
        "Load more"
      )}
    </button>
  );
}

function HoverActions({ onDragStart, onReader, onSave, onOpen, saved, canSave }) {
  return (
    <div className="absolute inset-0 bg-text/0 group-hover:bg-text/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
      <button {...onDragStart} className="p-2 rounded-lg bg-surface/70 text-text backdrop-blur-sm hover:bg-surface/90 transition-colors cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <button onClick={onReader} className="p-2 rounded-lg bg-surface/70 text-text backdrop-blur-sm hover:bg-surface/90 transition-colors" title="Reader">
        <BookOpen size={16} />
      </button>
      <button onClick={onSave} disabled={!canSave} className="p-2 rounded-lg bg-surface/70 text-text backdrop-blur-sm hover:bg-surface/90 transition-colors disabled:opacity-40" title="Save to workspace">
        {saved ? <Check size={16} /> : <Plus size={16} />}
      </button>
      <button onClick={onOpen} className="p-2 rounded-lg bg-surface/70 text-text backdrop-blur-sm hover:bg-surface/90 transition-colors" title="Open">
        <ExternalLink size={16} />
      </button>
    </div>
  );
}

function useSaveHandler(result, imgSrc) {
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

  const handleReader = useCallback((e) => {
    e.stopPropagation();
    openReader(result.url, result.title, imgSrc);
  }, [result, openReader, imgSrc]);

  const handleSummarizer = useCallback((e) => {
    e.stopPropagation();
    openSummarizer(result.url, result.title);
  }, [result, openSummarizer]);

  return { sessionId, activeWsId, saved, handleSave, handleReader, handleSummarizer };
}

const IMAGE_ASPECTS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-square", "aspect-[2/3]", "aspect-[4/3]"];
const VIDEO_ASPECTS = ["aspect-video", "aspect-video", "aspect-[4/3]", "aspect-video", "aspect-[3/2]"];

function DraggableImageCard({ result, featured = false, imgAspect, onThumbError }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-img-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const imgSrc = resultThumb(result);
  const { activeWsId, saved, handleSave, handleReader, handleSummarizer } = useSaveHandler(result, imgSrc);

  return (
    <div ref={setNodeRef} style={style}
      className={`group relative mb-3 rounded-xl overflow-hidden bg-panel cursor-default break-inside-avoid ${isDragging ? "opacity-50" : ""}`}
    >
      <div className={`relative overflow-hidden ${featured ? "aspect-[4/5]" : imgAspect || "aspect-[3/4]"}`}>
        {imgSrc ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
            alt="" className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.04]"
            onError={(e) => { e.target.style.display = "none"; onThumbError?.(imgSrc); }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dim text-sm">No image</div>
        )}
        <HoverActions
          onDragStart={listeners}
          onReader={handleReader}
          onSave={handleSave}
          onOpen={() => window.open(result.url, "_blank")}
          saved={saved}
          canSave={activeWsId}
        />
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-text/60 via-text/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-fast pointer-events-none">
          <p className="text-xs text-surface font-medium leading-snug line-clamp-2">{result.title}</p>
        </div>
      </div>
    </div>
  );
}

function DraggableVideoCard({ result, imgAspect = "aspect-video", onThumbError }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-vid-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const imgSrc = resultThumb(result);
  const { activeWsId, saved, handleSave, handleReader, handleSummarizer } = useSaveHandler(result, imgSrc);
  const duration = formatDuration(result);
  const domain = getHostname(result.url);

  return (
    <div ref={setNodeRef} style={style}
      className={`group relative mb-3 rounded-xl overflow-hidden bg-panel cursor-default break-inside-avoid ${isDragging ? "opacity-50" : ""}`}
    >
      <div className={`relative overflow-hidden bg-hover ${imgAspect}`}>
        {imgSrc ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
            alt="" className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.04]"
            onError={(e) => { e.target.style.display = "none"; onThumbError?.(imgSrc); }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-dim text-sm">No thumbnail</div>
        )}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-10 rounded-full bg-text/70 backdrop-blur-sm flex items-center justify-center shadow-raised transition-transform duration-slow ease-out group-hover:scale-110">
            <Play size={16} className="text-surface ml-0.5" />
          </div>
        </div>

        {duration && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-text/80 text-surface text-xs font-medium">
            {duration}
          </div>
        )}

        <HoverActions
          onDragStart={listeners}
          onReader={handleReader}
          onSave={handleSave}
          onOpen={() => window.open(result.url, "_blank")}
          saved={saved}
          canSave={activeWsId}
        />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-text leading-snug line-clamp-2">{result.title}</p>
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-dim">
          <Favicon domain={domain} />
          <span className="truncate">{domain || result.source || result.category}</span>
          {result.published_date && (
            <>
              <span className="shrink-0">·</span>
              <span className="shrink-0">{result.published_date}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableNewsCard({ result, onThumbError }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `discover-news-${result.url}`,
    data: { type: "search-result", result },
  });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const imgSrc = resultThumb(result);
  const { activeWsId, saved, handleSave, handleReader, handleSummarizer } = useSaveHandler(result, imgSrc);
  const domain = getHostname(result.url);

  return (
    <div ref={setNodeRef} style={style}
      className={`group relative flex items-start gap-3.5 px-3.5 py-3 rounded-xl cursor-default transition-all duration-slow ease-out break-inside-avoid ${
        isDragging ? "opacity-50" : "hover:bg-elevated hover:shadow-surface"
      }`}
    >
      <div className="size-11 shrink-0 rounded-lg overflow-hidden bg-hover flex items-center justify-center">
        {imgSrc ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
            alt="" className="w-full h-full object-cover transition-transform duration-slow ease-out group-hover:scale-[1.05]"
            onError={(e) => { e.target.style.display = "none"; onThumbError?.(imgSrc); }}
          />
        ) : (
          <Favicon domain={domain} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
          <span className="flex items-center gap-1 truncate">
            <Favicon domain={domain} />
            <span className="truncate">{domain || result.source || result.engine}</span>
          </span>
          {result.published_date && (
            <span className="flex items-center gap-1 shrink-0">
              <span>·</span>
              <span>{result.published_date}</span>
            </span>
          )}
          {result.category && result.category !== "general" && (
            <span className="px-1.5 py-0.5 rounded-md bg-hover text-muted">{result.category}</span>
          )}
        </div>
        <p className="text-sm font-medium text-text leading-snug mt-1 line-clamp-2">{result.title}</p>
        <div className="flex items-center gap-0.5 mt-2 opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-fast">
          <button {...listeners} className="p-1.5 rounded-md text-dim cursor-grab active:cursor-grabbing hover:text-text hover:bg-hover transition-colors" title="Drag">
            <GripVertical size={14} />
          </button>
          <button onClick={handleReader} className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Reader">
            <BookOpen size={14} />
          </button>
          <button onClick={handleSummarizer} className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Summarize">
            <Sparkles size={14} />
          </button>
          <button onClick={handleSave} disabled={!activeWsId} className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-colors disabled:opacity-30" title="Save to workspace">
            {saved ? <Check size={14} /> : <Plus size={14} />}
          </button>
          <button onClick={() => window.open(result.url, "_blank")} className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Open">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, count, loading, hasMore, onLoadMore }) {
  return (
    <div className="flex items-center justify-between px-1 pb-3 pt-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text tracking-tight">
        <Icon size={16} className="text-dim" />
        <span>{label}</span>
        {count > 0 && <span className="text-sm font-normal text-dim">{count}</span>}
      </div>
      <LoadMoreButton loading={loading} hasMore={hasMore} onClick={onLoadMore} />
    </div>
  );
}

function MultiRowScroll({ children, itemClass }) {
  const items = Children.toArray(children);
  const rows = [[], [], []];
  items.forEach((child, i) => rows[i % 3].push(child));
  return (
    <div className="space-y-2.5">
      {rows.map((row, ri) => (
        <div key={ri} className="overflow-x-auto overflow-y-hidden scrollbar-none -mx-4 px-4">
          <div className="flex gap-2.5 w-max items-stretch">
            {row.map((child, i) => (
              <div key={i} className={`shrink-0 ${itemClass}`}>{child}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiscoveryPanel() {
  const query = useSearchStore((s) => s.query);
  const imageResults = useSearchStore((s) => s.imageResults);
  const videoResults = useSearchStore((s) => s.videoResults);
  const newsResults = useSearchStore((s) => s.newsResults);
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

  const [failedThumbs, setFailedThumbs] = useState({});
  const markThumbFailed = useCallback((url) => {
    if (!url) return;
    setFailedThumbs((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }, []);
  const visible = useCallback(
    (list) => list.filter((r) => {
      const src = resultThumb(r);
      return src && !failedThumbs[src];
    }),
    [failedThumbs]
  );
  const visibleImages = visible(imageResults);
  const visibleVideos = visible(videoResults);
  const visibleNews = visible(newsResults);

  const autoLoads = useRef(0);
  useEffect(() => {
    if (Object.keys(failedThumbs).length === 0 || autoLoads.current >= 3) return;
    autoLoads.current += 1;
    if (hasMoreImages) loadMoreImages();
    if (hasMoreVideos) loadMoreVideos();
    if (hasMoreNews) loadMoreNews();
  }, [failedThumbs, hasMoreImages, hasMoreVideos, hasMoreNews, loadMoreImages, loadMoreVideos, loadMoreNews]);

  const [measureRef, panelWidth] = useElementWidth();
  const base = panelWidth || 400;
  const imagesCols = Math.max(2, Math.floor(base / 189));
  const videosCols = Math.max(1, Math.floor(base / 297));
  const newsCols = Math.max(1, Math.floor(base / 340));

  const hasContent = query && (
    visibleImages.length > 0 || visibleVideos.length > 0 ||
    visibleNews.length > 0
  );

  const showAll = activeFilter === "all";

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-text tracking-tight">Discovery</h2>
            </div>
            <button
              onClick={() => toggleExpand("discovery")}
              className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-fast ${
                  activeFilter === f.id
                    ? "bg-elevated text-text shadow-surface"
                    : "text-muted hover:text-text hover:bg-hover"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6" ref={measureRef}>
        {loading ? (
          <SkeletonDiscovery />
        ) : !query ? (
          <div className="px-4 py-16 text-center text-sm text-muted">
            Search to see related content here
          </div>
        ) : !hasContent ? (
          <div className="px-4 py-12 text-center text-sm text-muted">
            No additional content found
          </div>
        ) : (
          <div key={activeFilter} className="animate-fade-in">
            {(showAll || activeFilter === "images") && visibleImages.length > 0 && (
              <div>
              <SectionHeader icon={Image} label="Images" count={visibleImages.length}
                loading={loading} hasMore={hasMoreImages} onLoadMore={loadMoreImages} />
              {showAll ? (
                <MultiRowScroll itemClass="w-[154px]">
                  {visibleImages.map((r, i) => (
                    <DraggableImageCard key={`img-${r.url}-${i}`} result={r} featured={i === 0} onThumbError={markThumbFailed} />
                  ))}
                </MultiRowScroll>
              ) : (
                <div className="gap-3" style={{ columnCount: imagesCols }}>
                  {visibleImages.map((r, i) => (
                    <DraggableImageCard key={`img-${r.url}-${i}`} result={r} featured={i === 0} imgAspect={IMAGE_ASPECTS[(i * 3) % IMAGE_ASPECTS.length]} onThumbError={markThumbFailed} />
                  ))}
                </div>
              )}
              </div>
            )}

            {(showAll || activeFilter === "videos") && visibleVideos.length > 0 && (
              <div>
                <SectionHeader icon={Youtube} label="Videos" count={visibleVideos.length}
                  loading={loading} hasMore={hasMoreVideos} onLoadMore={loadMoreVideos} />
                {showAll ? (
                  <MultiRowScroll itemClass="w-56">
                    {visibleVideos.map((r, i) => (
                      <DraggableVideoCard key={`vid-${r.url}-${i}`} result={r} onThumbError={markThumbFailed} />
                    ))}
                  </MultiRowScroll>
                ) : (
                <div className="gap-3" style={{ columnCount: videosCols }}>
                  {visibleVideos.map((r, i) => (
                    <DraggableVideoCard key={`vid-${r.url}-${i}`} result={r} imgAspect={VIDEO_ASPECTS[i % VIDEO_ASPECTS.length]} onThumbError={markThumbFailed} />
                  ))}
                </div>
                )}
              </div>
            )}

            {(showAll || activeFilter === "news") && visibleNews.length > 0 && (
              <div>
                <SectionHeader icon={Newspaper} label="News" count={visibleNews.length}
                  loading={loading} hasMore={hasMoreNews} onLoadMore={loadMoreNews} />
                {showAll ? (
                  <MultiRowScroll itemClass="w-72">
                    {visibleNews.map((r, i) => (
                      <DraggableNewsCard key={`news-${r.url}-${i}`} result={r} onThumbError={markThumbFailed} />
                    ))}
                  </MultiRowScroll>
                ) : (
                  <div className="gap-3" style={{ columnCount: newsCols }}>
                    {visibleNews.map((r, i) => (
                      <DraggableNewsCard key={`news-${r.url}-${i}`} result={r} onThumbError={markThumbFailed} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
