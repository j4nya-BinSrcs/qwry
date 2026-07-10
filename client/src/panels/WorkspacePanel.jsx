import { Book, ExternalLink, GripVertical, Loader2, MessageCircle, Pencil, Sparkles, Trash2, X, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useSearchStore } from "../stores/searchStore";
import ChatModal from "../components/ChatModal";
import ReaderModal from "../components/ReaderModal";

function WorkspaceItemCard({ item }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const summarizeItem = useWorkspaceStore((s) => s.summarizeItem);
  const summarizingId = useWorkspaceStore((s) => s.summarizingId);
  const [expanded, setExpanded] = useState(false);
  const [readerUrl, setReaderUrl] = useState(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "workspace-item", item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const isSummarizing = summarizingId === item.id;
  const hasSummary = !!item.summary;

  const handleRead = useCallback(
    (e) => {
      e.stopPropagation();
      setReaderUrl(item.url);
    },
    [item.url]
  );

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
      ref={setNodeRef}
      style={style}
      onClick={() => setExpanded(!expanded)}
      className="group bg-elevated border border-border rounded-lg transition-all hover:border-border/80 cursor-pointer"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
        >
          <GripVertical size={14} />
        </button>
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
            onClick={handleRead}
            className="p-1.5 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
            title="Reader view"
          >
            <Book size={13} />
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
      {readerUrl && (
        <ReaderModal
          url={readerUrl}
          mediaUrl={item.media_url}
          title={item.title}
          onClose={() => setReaderUrl(null)}
        />
      )}
    </div>
  );
}

function WorkspaceHeader({ workspace, sessionId, onChatClick }) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const startEdit = useCallback((e) => {
    e.stopPropagation();
    setNameInput(workspace?.name || "");
    setEditing(true);
  }, [workspace]);

  const cancelEdit = useCallback((e) => {
    e.stopPropagation();
    setEditing(false);
  }, []);

  const saveEdit = useCallback(async (e) => {
    e.stopPropagation();
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== workspace.name) {
      await updateWorkspace(sessionId, workspace.id, trimmed, null);
    }
    setEditing(false);
  }, [nameInput, workspace, sessionId, updateWorkspace]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") saveEdit(e);
    if (e.key === "Escape") cancelEdit(e);
  }, [saveEdit, cancelEdit]);

  return (
    <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 bg-hover border border-border rounded px-2 py-0.5 text-sm font-semibold text-text outline-none focus:border-accent/30"
            />
            <button onClick={saveEdit} className="p-1 rounded text-dim hover:text-accent"><Check size={14} /></button>
            <button onClick={cancelEdit} className="p-1 rounded text-dim hover:text-text"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group/title">
            <h1 className="text-base font-semibold text-text truncate">
              {workspace?.name || "Research Workspace"}
            </h1>
            {workspace && (
              <button
                onClick={startEdit}
                className="p-0.5 rounded text-dim opacity-0 group-hover/title:opacity-100 hover:text-text transition-all"
                title="Rename"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted">
            {workspace?.item_count ?? 0} items collected
          </p>
          {workspace && workspace.item_count > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onChatClick(); }}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
            >
              <MessageCircle size={11} />
              Chat
            </button>
          )}
        </div>
      </div>
      {!workspace && (
        <button
          onClick={() => {
            const name = prompt("Workspace name:");
            if (name) createWorkspace(sessionId, name);
          }}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          + New Workspace
        </button>
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
  const [chatOpen, setChatOpen] = useState(false);

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
      <WorkspaceHeader workspace={activeWs} sessionId={sessionId} onChatClick={() => setChatOpen(true)} />

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
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="space-y-1.5 p-3">
              {items.map((item) => (
                <WorkspaceItemCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
      {chatOpen && activeId && (
        <ChatModal
          workspaceId={activeId}
          workspaceName={activeWs?.name}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}