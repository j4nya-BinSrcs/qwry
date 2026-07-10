import { ExternalLink, GripVertical, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSearchStore } from "../stores/searchStore";

function WorkspaceItemCard({ item }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const summarizeItem = useWorkspaceStore((s) => s.summarizeItem);
  const summarizingId = useWorkspaceStore((s) => s.summarizingId);
  const [expanded, setExpanded] = useState(false);

  const isSummarizing = summarizingId === item.id;
  const hasSummary = !!item.summary;

  const handleDelete = useCallback(
    (e) => {
      e.stopPropagation();
      deleteItem(sessionId, item.id);
    },
    [sessionId, item.id, deleteItem]
  );

  const handleSummarize = useCallback(
    (e) => {
      e.stopPropagation();
      summarizeItem(sessionId, item.id);
    },
    [sessionId, item.id, summarizeItem]
  );

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="group bg-elevated border border-border rounded-lg transition-all hover:border-border/80 cursor-pointer"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <GripVertical
          size={14}
          className="mt-1 shrink-0 text-dim cursor-grab active:cursor-grabbing"
        />
        <img
          src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`}
          alt=""
          className="size-4 rounded shrink-0 mt-0.5"
          onError={(e) => (e.target.style.display = "none")}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">
            {item.title || "Untitled"}
          </div>
          <div className="text-xs text-muted mt-0.5 truncate">
            {new URL(item.url).hostname}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="p-1.5 rounded-md text-dim hover:text-accent hover:bg-accent/10 transition-all"
            title={hasSummary ? "Re-summarize" : "Summarize"}
          >
            {isSummarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.url, "_blank");
            }}
            className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md text-dim hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded && (item.snippet || item.notes || hasSummary || isSummarizing) && (
        <div className="px-3.5 pb-3 border-t border-border space-y-2">
          {item.snippet && (
            <p className="text-xs text-muted mt-2 leading-relaxed">
              {item.snippet}
            </p>
          )}
          {item.notes && (
            <p className="text-xs text-dim leading-relaxed italic">
              {item.notes}
            </p>
          )}
          {isSummarizing && (
            <div className="flex items-center gap-2 text-xs text-muted mt-2">
              <Loader2 size={12} className="animate-spin" />
              Generating summary…
            </div>
          )}
          {hasSummary && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-accent">
                <Sparkles size={11} />
                <span className="font-medium">Summary</span>
                <span className="text-dim font-normal">
                  via {item.summary_model || item.summary_provider || "ollama"}
                </span>
              </div>
              <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                {item.summary}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkspacePanel() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useWorkspaceStore((s) => s.items);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const loadItems = useWorkspaceStore((s) => s.loadItems);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const query = useSearchStore((s) => s.query);

  const { setNodeRef, isOver } = useDroppable({
    id: "workspace-drop",
    data: { type: "workspace" },
  });

  useEffect(() => {
    if (activeId) loadItems(sessionId, activeId);
  }, [activeId, sessionId, loadItems]);

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">
            {activeWs?.name || "Research Workspace"}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            {activeWs?.item_count ?? 0} items collected
          </p>
        </div>
        {!activeWs && (
          <button
            onClick={() => {
              const name = prompt("Workspace name:");
              if (name) createWorkspace(sessionId, name);
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            + New Workspace
          </button>
        )}
      </div>

      {/* Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto transition-all ${
          isOver
            ? "bg-accent/5 border-2 border-dashed border-accent/30"
            : ""
        }`}
      >
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="size-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="px-4 py-3 m-4 text-sm text-red-400 bg-red-500/5 rounded-lg">
            {error}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="size-10 rounded-xl bg-elevated border border-border flex items-center justify-center mb-4">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-dim"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-sm text-muted max-w-xs">
              Drag search results from the left panel or search the web to start
              building your research workspace
            </p>
            {!activeWs && (
              <button
                onClick={() => {
                  const name = prompt("Workspace name:");
                  if (name) createWorkspace(sessionId, name);
                }}
                className="mt-4 text-xs px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Create Workspace
              </button>
            )}
          </div>
        )}
        {items.length > 0 && (
          <div className="space-y-1.5 p-3">
            {items.map((item) => (
              <WorkspaceItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}