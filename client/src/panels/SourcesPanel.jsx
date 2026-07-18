import { ExternalLink, GripVertical, Plus, BookOpen, Sparkles, Search, Newspaper, Youtube, MessageCircle, Image, Code, Globe } from "lucide-react";
import { useCallback } from "react";
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

function Favicon({ domain }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className="size-4 rounded shrink-0"
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
      className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-md transition-all cursor-default ${
        isDragging
          ? "opacity-50"
          : "hover:bg-hover border border-transparent hover:border-border"
      }`}
    >
      <button
        {...listeners}
        className="mt-0.5 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
      >
        <GripVertical size={14} />
      </button>

      {result.img_src ? (
        <img
          src={`/api/image-proxy?url=${encodeURIComponent(result.img_src)}`}
          alt=""
          className="size-8 rounded object-cover shrink-0 mt-0.5"
          onError={(e) => (e.target.style.display = "none")}
        />
      ) : (
        <Favicon domain={new URL(result.url).hostname} />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">
            {result.title}
          </span>
          {result.category && result.category !== "general" && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-hover text-text shrink-0">
              {result.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted truncate">
            {new URL(result.url).hostname}
          </span>
          {result.source && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-hover text-text">
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
          <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
            {result.snippet}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleReader}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
          title="Reader view"
        >
          <BookOpen size={13} />
        </button>
        <button
          onClick={handleSummarizer}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
          title="Summarize"
        >
          <Sparkles size={13} />
        </button>
        <button
          onClick={() => window.open(result.url, "_blank")}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
          title="Open"
        >
          <ExternalLink size={13} />
        </button>
        <button
          onClick={handleAdd}
          className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
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
  const filtered = results.filter((r) => matchFilter(r, activeFilter));

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex-1 rounded-xl border border-border bg-white overflow-hidden flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text uppercase tracking-wider">
            Sources
          </h2>
          <span className="text-xs text-dim">{filtered.length} results</span>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Filter sidebar */}
          <div className="shrink-0 w-fit flex flex-col items-center gap-3 py-3 px-1.5 border-r border-border">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-black text-[#ffffff]"
                      : "text-text hover:bg-hover"
                  }`}
                  title={f.label}
                >
                  <Icon size={14} />
                  <span className="text-[7px] leading-tight font-medium">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="size-4 border-2 border-text border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {error && (
              <div className="px-4 py-3 text-sm text-text bg-hover rounded-md mx-2 mt-2">
                {error}
              </div>
            )}
            {!loading && !error && results.length === 0 && query && (
              <div className="px-4 py-12 text-center text-sm text-muted">
                No results found
              </div>
            )}
            {!loading && !error && results.length === 0 && !query && (
              <div className="px-4 py-12 text-center text-sm text-muted">
                Search the web to see results here
              </div>
            )}
            {!loading && !error && results.length > 0 && filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted">
                No results match the selected filter
              </div>
            )}
            <div className="space-y-0.5 px-1">
              {filtered.map((result, i) => (
                <DraggableResultCard key={`${result.url}-${i}`} result={result} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
