import { ExternalLink, GripVertical, Plus, BookOpen, Sparkles, Search, Newspaper, Youtube, MessageCircle, Image, Code, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";

const FILTERS = [
  { id: "all", label: "All", icon: Search },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "articles", label: "Articles", icon: Globe },
  { id: "discussions", label: "Discussions", icon: MessageCircle },
  { id: "videos", label: "Videos", icon: Youtube },
  { id: "shopping", label: "Shopping", icon: Image },
  { id: "news", label: "News", icon: Newspaper },
  { id: "official", label: "Official", icon: Globe },
  { id: "code", label: "Code", icon: Code },
];

const ITEMS_PER_PAGE = 8;

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function Favicon({ domain }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className="size-4 rounded shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
      onError={(e) => (e.target.style.display = "none")}
    />
  );
}

function DraggableResultCard({ result }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `result-${result.url}`,
      data: { type: "search-result", result },
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);

  const handleAdd = useCallback(
    (e) => {
      e.stopPropagation();
      if (activeId) {
        addItem(sessionId, activeId, result.url, result.title, result.snippet, result.source);
      }
    },
    [sessionId, activeId, result, addItem]
  );

  const handleReader = useCallback(
    (e) => {
      e.stopPropagation();
      openReader(result.url, result.title, result.img_src);
    },
    [result, openReader]
  );

  const handleSummarizer = useCallback(
    (e) => {
      e.stopPropagation();
      openSummarizer(result.url, result.title);
    },
    [result, openSummarizer]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-start gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 cursor-default ${
        isDragging
          ? "opacity-50"
          : "glass-card hover:bg-hover/80 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/5 border border-border/70"
      }`}
    >
      <button
        {...listeners}
        className="mt-1 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-violet-400 transition-colors"
      >
        <GripVertical size={14} />
      </button>

      {result.img_src ? (
        <img
          src={`/api/image-proxy?url=${encodeURIComponent(result.img_src)}`}
          alt=""
          className="size-10 rounded-lg object-cover shrink-0 mt-0.5 border border-border/50 shadow-sm"
          onError={(e) => (e.target.style.display = "none")}
        />
      ) : (
        <div className="mt-0.5 p-1.5 rounded-lg bg-surface/80 border border-border/60">
          <Favicon domain={getHostname(result.url)} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text truncate group-hover:text-violet-300 transition-colors">
            {result.title}
          </span>
          {result.category && result.category !== "general" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 shrink-0">
              {result.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted truncate">
            {getHostname(result.url)}
          </span>
          {result.source && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              {result.source}
            </span>
          )}
          {result.relevance_score && (
            <span className="text-xs text-dim font-mono">
              {Math.round(result.relevance_score * 100)}%
            </span>
          )}
        </div>
        {result.snippet && (
          <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed opacity-90">
            {result.snippet}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <button
          onClick={handleReader}
          className="p-1.5 rounded-lg text-muted hover:text-violet-300 hover:bg-violet-500/15 border border-transparent hover:border-violet-500/20 transition-all"
          title="Reader view"
        >
          <BookOpen size={13} />
        </button>
        <button
          onClick={handleSummarizer}
          className="p-1.5 rounded-lg text-muted hover:text-cyan-300 hover:bg-cyan-500/15 border border-transparent hover:border-cyan-500/20 transition-all"
          title="Summarize"
        >
          <Sparkles size={13} />
        </button>
        <button
          onClick={() => window.open(result.url, "_blank")}
          className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all"
          title="Open"
        >
          <ExternalLink size={13} />
        </button>
        <button
          onClick={handleAdd}
          className="p-1.5 rounded-lg text-muted hover:text-emerald-300 hover:bg-emerald-500/15 border border-transparent hover:border-emerald-500/20 transition-all"
          title="Add to workspace"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function matchFilter(r, filterId) {
  if (filterId === "all") return true;
  const cat = (r.category || "").toLowerCase();
  let host = "";
  try { host = new URL(r.url).hostname.toLowerCase(); } catch {}
  const title = (r.title || "").toLowerCase();
  const snippet = (r.snippet || "").toLowerCase();
  const text = title + " " + snippet;

  switch (filterId) {
    case "research":
      return cat === "general" || cat === "science" || cat === "encyclopedia" || cat === "reference" ||
             host.endsWith(".edu") || host.includes("wikipedia") || host.includes("academic") ||
             host.includes("scholar") || host.includes("arxiv") || host.includes("cambridge") ||
             host.includes("springer") || host.includes("ieee") || host.includes("acm.org") ||
             text.includes("research paper") || text.includes("study shows");
    case "articles":
      return cat === "articles" || cat === "blog" || cat === "opinion" || cat === "blogs" ||
             host.includes("medium.com") || host.includes("substack") || host.includes("wordpress") ||
             host.includes("blog") || host.includes("tutorial") ||
             text.includes("blog post") || text.includes("tutorial") || text.includes("opinion");
    case "discussions":
      return cat.includes("discuss") || cat.includes("forum") || cat.includes("qa") || cat === "social media" ||
             host.includes("reddit") || host.includes("stackoverflow") || host.includes("stackexchange") ||
             host.includes("quora") || host.includes("discourse") || host.includes("forum");
    case "videos":
      return cat === "videos" || cat === "video" ||
             host.includes("youtube") || host.includes("youtu.be") || host.includes("vimeo") ||
             host.includes("twitch") || host.includes("dailymotion");
    case "news":
      return cat === "news" || cat === "newspaper" ||
             host.includes("cnn.com") || host.includes("nytimes") || host.includes("reuters") ||
             host.includes("bbc") || host.includes("theguardian") || host.includes("bloomberg") ||
             text.includes("breaking news") || text.includes("report") && text.includes("today");
    case "shopping":
      return cat === "shopping" || cat.includes("shop") || cat === "products" ||
             host.includes("amazon") || host.includes("ebay") || host.includes("walmart") ||
             host.includes("etsy") || host.includes("bestbuy") || host.includes("target.com") ||
             host.includes("alibaba") || host.includes("aliexpress") ||
             text.includes("buy ") || text.includes("price") || text.includes("$");
    case "official":
      return host.endsWith(".gov") || host.endsWith(".mil") || host.endsWith(".gov.uk") ||
             cat.includes("official") || cat.includes("documentation") || cat === "standards" ||
             host.includes("company/") || host.includes("about") ||
             text.includes("official website") || text.includes("documentation") || text.includes("standards");
    case "code":
      return host.includes("github") || host.includes("gitlab") || host.includes("bitbucket") ||
             host.includes("npmjs") || host.includes("pypi") || host.includes("crates.io") ||
             host.includes("docs.rs") || host.includes("packagist") || host.includes("nuget") ||
             host.includes("docker") || host.includes("hub.docker") ||
             cat === "it" || cat === "code" || cat === "repository" || cat === "package" ||
             text.includes("source code") || text.includes("api reference") || text.includes("sdk");
    default:
      return false;
  }
}

export default function SourcesPanel() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const activeFilter = useSearchStore((s) => s.activeFilter);
  const setActiveFilter = useSearchStore((s) => s.setActiveFilter);
  
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = results.filter((r) => matchFilter(r, activeFilter));
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, query, results]);

  const paginatedResults = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex-1 rounded-2xl border border-border/80 bg-panel/70 backdrop-blur-xl overflow-hidden flex flex-col shadow-lg">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/80 flex items-center justify-between bg-surface/40">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-violet-500 animate-pulse" />
            <h2 className="text-xs font-bold text-text uppercase tracking-wider font-heading">
              Pages
            </h2>
          </div>
          <span className="text-xs text-muted font-medium px-2 py-0.5 rounded-full bg-hover border border-border/50">
            {filtered.length} {filtered.length === 1 ? "page" : "pages"}
          </span>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Filter sidebar with uniform button shapes */}
          <div className="shrink-0 w-16 flex flex-col items-center gap-1.5 py-3 px-1.5 border-r border-border/80 bg-surface/30">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`w-full h-12 flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 border ${
                    isActive
                      ? "bg-gradient-to-b from-violet-600 to-indigo-600 text-white border-violet-400/60 shadow-md shadow-violet-500/25 scale-[1.03] font-semibold"
                      : "bg-transparent text-muted hover:text-text hover:bg-hover/80 border-transparent hover:border-border/60"
                  }`}
                  title={f.label}
                >
                  <Icon size={15} />
                  <span className="text-[9px] leading-none font-medium truncate w-full text-center px-0.5">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Results + Pagination */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <div className="size-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shadow-lg" />
                </div>
              )}
              {error && (
                <div className="px-4 py-3 text-sm text-text bg-red-500/10 border border-red-500/20 rounded-xl mx-2 mt-2">
                  {error}
                </div>
              )}
              {!loading && !error && results.length === 0 && query && (
                <div className="px-4 py-16 text-center text-sm text-muted">
                  No results found for "{query}"
                </div>
              )}
              {!loading && !error && results.length === 0 && !query && (
                <div className="px-4 py-16 text-center text-sm text-muted">
                  Search the web to explore pages here
                </div>
              )}
              {!loading && !error && results.length > 0 && filtered.length === 0 && (
                <div className="px-4 py-16 text-center text-sm text-muted">
                  No results match the selected filter
                </div>
              )}

              {paginatedResults.map((result, i) => (
                <DraggableResultCard key={`${result.url}-${i}`} result={result} />
              ))}
            </div>

            {/* Pagination Controls */}
            {!loading && !error && totalPages > 1 && (
              <div className="shrink-0 px-4 py-2.5 border-t border-border/80 bg-surface/50 backdrop-blur-md flex items-center justify-between">
                <span className="text-xs text-muted font-medium">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                  {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-border/80 text-text hover:bg-hover hover:border-violet-500/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-border/80 transition-all"
                    title="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                      <button
                        key={pg}
                        onClick={() => setCurrentPage(pg)}
                        className={`size-6 rounded-lg text-xs font-medium transition-all ${
                          currentPage === pg
                            ? "bg-violet-600 text-white shadow-md shadow-violet-500/25 scale-105"
                            : "text-muted hover:text-text hover:bg-hover"
                        }`}
                      >
                        {pg}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-border/80 text-text hover:bg-hover hover:border-violet-500/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-border/80 transition-all"
                    title="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

