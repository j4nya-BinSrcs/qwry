import { ExternalLink, GripVertical, Plus, Search } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSessionStore } from "../stores/sessionStore";

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

  const handleAdd = useCallback(
    (e) => {
      e.stopPropagation();
      if (activeId) {
        addItem(sessionId, activeId, result.url, result.title, result.snippet, result.source);
      }
    },
    [sessionId, activeId, result, addItem]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-all cursor-default ${
        isDragging
          ? "opacity-50"
          : "hover:bg-hover border border-transparent hover:border-border"
      }`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        className="mt-0.5 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
      >
        <GripVertical size={14} />
      </button>

      {/* Favicon */}
      <Favicon domain={new URL(result.url).hostname} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">
            {result.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted truncate">
            {new URL(result.url).hostname}
          </span>
          {result.source && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                result.source === "engine"
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-sky-500/10 text-sky-400"
              }`}
            >
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

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => window.open(result.url, "_blank")}
          className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
          title="Open"
        >
          <ExternalLink size={13} />
        </button>
        <button
          onClick={handleAdd}
          className="p-1 rounded-md text-dim hover:text-accent hover:bg-accent/10 transition-all"
          title="Add to workspace"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export default function SourcesPanel() {
  const query = useSearchStore((s) => s.query);
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const search = useSearchStore((s) => s.search);
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? results.filter(
        (r) =>
          r.title?.toLowerCase().includes(filter.toLowerCase()) ||
          r.snippet?.toLowerCase().includes(filter.toLowerCase())
      )
    : results;

  return (
    <div className="h-full flex flex-col bg-panel border-r border-border">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Sources
          </h2>
          <span className="text-xs text-dim">{results.length} results</span>
        </div>
        {query && (
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
            />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter results..."
              className="w-full h-7 pl-8 pr-2 rounded-md bg-hover border border-border text-xs text-text placeholder:text-dim outline-none focus:border-accent/30 transition-all"
            />
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="size-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-sm text-red-400 bg-red-500/5 rounded-lg mx-2">
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
        <div className="space-y-0.5 px-1">
          {filtered.map((result, i) => (
            <DraggableResultCard key={`${result.url}-${i}`} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}