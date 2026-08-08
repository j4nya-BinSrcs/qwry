import { ExternalLink, Plus, BookOpen, Search, MessageCircle, Globe, Link, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { SkeletonRow } from "../components/Skeleton";

const FILTERS = [
  { id: "all", label: "All", icon: Search },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "discussions", label: "Discussions", icon: MessageCircle },
  { id: "official", label: "Official", icon: Globe },
];

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function DraggableResultCard({ result }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `result-${result.url}`,
      data: { type: "search-result", result },
      activationConstraint: { distance: 5 },
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [copied, setCopied] = useState(false);

  const domain = getHostname(result.url);
  const imgSrc = result.img_src || result.thumbnail;
  const engine = result.engine && result.engine !== result.source ? result.engine : null;

  const handleAddToWorkspace = useCallback(
    (e) => {
      e.stopPropagation();
      if (!activeId) return;
      addItem(sessionId, activeId, result.url, result.title, result.snippet, result.source, imgSrc);
      setContextMode("workspace");
    },
    [sessionId, activeId, result, addItem, imgSrc, setContextMode]
  );

  const handleCopy = useCallback(
    async (e) => {
      e.stopPropagation();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(result.url);
        } else {
          const ta = document.createElement("textarea");
          ta.value = result.url;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
      } catch {}
    },
    [result.url]
  );

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`group relative rounded-2xl bg-panel shadow-surface p-4 cursor-grab active:cursor-grabbing transition-all duration-slow ease-out ${
        isDragging
          ? "opacity-50 shadow-pop"
          : "hover:-translate-y-0.5 hover:shadow-raised hover:ring-1 hover:ring-accent/50 hover:bg-accent/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Large media / favicon */}
        <div className="size-11 shrink-0 rounded-xl overflow-hidden bg-hover flex items-center justify-center transition-transform duration-slow ease-out group-hover:scale-[1.05]">
          {imgSrc ? (
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(imgSrc)}`}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => (e.target.style.display = "none")}
            />
          ) : (
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
              alt=""
              className="size-7"
              onError={(e) => (e.target.style.display = "none")}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text leading-snug">{result.title}</h3>

          {/* Meta: publisher · category · engine */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-sm font-medium text-accent hover:underline truncate max-w-44"
              title="Open in new tab"
            >
              <ExternalLink size={12} className="shrink-0" />
              <span className="truncate">{domain}</span>
            </a>
            {result.category && result.category !== "general" && (
              <span className="text-sm text-muted px-1.5 py-0.5 rounded-md bg-hover">
                {result.category}
              </span>
            )}
            {engine && (
              <span className="flex items-center gap-1 text-sm text-muted px-1.5 py-0.5 rounded-md bg-hover">
                <Search size={12} />
                {engine}
              </span>
            )}
          </div>

          {result.snippet && (
            <p className="text-base text-muted leading-relaxed mt-2 line-clamp-3">{result.snippet}</p>
          )}

          {/* Accordion actions — expand on hover */}
          <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-slow ease-out">
            <div className="overflow-hidden min-h-0">
              <div className="pt-3 mt-3 border-t border-border/60 flex items-center gap-0.5 pb-1">
                <button
                  onClick={handleAddToWorkspace}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={!activeId}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-text hover:bg-hover transition-colors disabled:opacity-30"
                  title="Add to active workspace"
                >
                  <Plus size={14} />
                  Workspace
                </button>
                <button
                  onClick={handleCopy}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-text hover:bg-hover transition-colors"
                  title="Copy link"
                >
                  {copied ? <Check size={14} className="text-accent" /> : <Link size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
    case "discussions":
      return cat.includes("discuss") || cat.includes("forum") || cat.includes("qa") || cat === "social media" ||
             host.includes("reddit") || host.includes("stackoverflow") || host.includes("stackexchange") ||
             host.includes("quora") || host.includes("discourse") || host.includes("forum");
    case "official":
      return host.endsWith(".gov") || host.endsWith(".mil") || host.endsWith(".gov.uk") ||
             cat.includes("official") || cat.includes("documentation") || cat === "standards" ||
             host.includes("company/") || host.includes("about") ||
             text.includes("official website") || text.includes("documentation") || text.includes("standards");
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
  const loadMorePages = useSearchStore((s) => s.loadMorePages);
  const totalResults = useSearchStore((s) => s.totalResults);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sessionId = useSessionStore((s) => s.sessionId);
  const addItemsBulk = useWorkspaceStore((s) => s.addItemsBulk);
  const filtered = results.filter((r) => matchFilter(r, activeFilter));
  const uniqueCount = new Set(results.map((r) => r.url)).size;
  const hasMore = results.length < totalResults;
  const [transferMsg, setTransferMsg] = useState("");

  const handleTransferAll = useCallback(async () => {
    if (!activeId) return;
    const items = useSearchStore.getState().collectTransferSources();
    if (items.length === 0) return;
    setTransferMsg("");
    try {
      const result = await addItemsBulk(sessionId, activeId, items);
      if (result) {
        const parts = [];
        if (result.created.length) parts.push(`${result.created.length} added`);
        if (result.duplicates.length) parts.push(`${result.duplicates.length} duplicates`);
        if (result.rejected) parts.push(`${result.rejected} skipped (limit)`);
        setTransferMsg(parts.join(" · "));
        setTimeout(() => setTransferMsg(""), 4000);
      }
    } catch {
      setTransferMsg("Transfer failed");
      setTimeout(() => setTransferMsg(""), 3000);
    }
  }, [sessionId, activeId, addItemsBulk]);

  const handleLoadMore = useCallback(async () => {
    await loadMorePages();
  }, [loadMorePages]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-base font-semibold text-text tracking-tight">Pages</h2>
          <span className="text-sm text-dim">{uniqueCount} result{uniqueCount !== 1 ? "s" : ""}</span>
        </div>
        {hasMore && (
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md text-text hover:bg-hover transition-colors shrink-0"
          >
            Load more
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="shrink-0 flex items-center gap-1 px-5 pb-4 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-fast shrink-0 ${
                isActive
                  ? "bg-elevated text-text shadow-surface"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            >
              <Icon size={14} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
       <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 space-y-3">
        {loading && (
          <SkeletonRow count={6} />
        )}
        {error && (
          <div className="px-4 py-3 text-sm text-text bg-hover rounded-lg mx-1">
            {error}
          </div>
        )}
        {!loading && !error && results.length === 0 && query && (
          <div className="px-4 py-16 text-center text-sm text-muted">
            No results found
          </div>
        )}
        {!loading && !error && results.length === 0 && !query && (
          <div className="px-4 py-16 text-center text-sm text-muted">
            Search the web to see results here
          </div>
        )}
        {!loading && !error && results.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted">
            No results match the selected filter
          </div>
        )}
        <div key={activeFilter} className="animate-fade-in">
          {filtered.map((result, i) => (
            <DraggableResultCard
              key={`${result.url}-${i}`}
              result={result}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
