import { Book, ExternalLink, GripVertical, Loader2, Pencil, Sparkles, Trash2, X, Check, MessageCircle, Construction } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useUIStore } from "../stores/uiStore";
import ChatModal from "../components/ChatModal";

function WorkspaceItemCard({ item }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const summarizeItem = useWorkspaceStore((s) => s.summarizeItem);
  const summarizingId = useWorkspaceStore((s) => s.summarizingId);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const [expanded, setExpanded] = useState(false);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => setExpanded(!expanded)}
      className="group bg-panel border border-border rounded-md transition-all hover:border-text cursor-pointer"
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button {...attributes} {...listeners}
          className="mt-0.5 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
        >
          <GripVertical size={14} />
        </button>
        <img
          src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`}
          alt="" className="size-4 rounded shrink-0 mt-0.5"
          onError={(e) => (e.target.style.display = "none")}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">{item.title || "Untitled"}</div>
          <div className="text-xs text-muted mt-0.5 truncate">{new URL(item.url).hostname}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); openReader(item.url, item.title, item.media_url); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Reader"
          >
            <Book size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); summarizeItem(sessionId, item.id); }} disabled={isSummarizing}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
            title={hasSummary ? "Re-summarize" : "Summarize"}
          >
            {isSummarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); window.open(item.url, "_blank"); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
          >
            <ExternalLink size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(sessionId, item.id); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded && (item.snippet || item.notes || hasSummary || isSummarizing) && (
        <div className="px-3 pb-2.5 border-t border-border space-y-1.5">
          {item.snippet && <p className="text-xs text-muted mt-1.5 leading-relaxed">{item.snippet}</p>}
          {item.notes && <p className="text-xs text-dim leading-relaxed italic">{item.notes}</p>}
          {isSummarizing && (
            <div className="flex items-center gap-1.5 text-xs text-muted mt-1.5">
              <Loader2 size={11} className="animate-spin" />
              Generating summary...
            </div>
          )}
          {hasSummary && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text">
                <Sparkles size={11} />
                <span className="font-medium">Summary</span>
                <span className="text-dim font-normal">
                  via {item.summary_model || item.summary_provider || "ollama"}
                </span>
              </div>
              <p className="text-xs text-text leading-relaxed whitespace-pre-line">{item.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkspaceHeader({ workspace, sessionId, onChatClick }) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showWsMenu, setShowWsMenu] = useState(false);

  const startEdit = useCallback((e) => {
    e.stopPropagation();
    setNameInput(workspace?.name || "");
    setEditing(true);
  }, [workspace]);

  const saveEdit = useCallback(async (e) => {
    e.stopPropagation();
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== workspace.name) {
      await updateWorkspace(sessionId, workspace.id, trimmed, null);
    }
    setEditing(false);
  }, [nameInput, workspace, sessionId, updateWorkspace]);

  return (
    <div className="shrink-0 px-3 py-2 border-b border-border flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Quick workspace switcher */}
          <div className="relative">
            <button
              onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center gap-2 text-sm font-semibold text-text hover:text-muted transition-colors"
            >
              <span className="truncate max-w-28">{workspace?.name || "Workspace"}</span>
              <span className="text-xs text-dim">{workspace?.item_count ?? 0}</span>
            </button>
            {showWsMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded bg-elevated border border-border overflow-hidden z-10">
                <div className="px-3 py-1.5 text-[10px] text-muted font-medium border-b border-border">Workspaces</div>
                {workspaces.map((ws) => (
                  <button key={ws.id}
                    onClick={() => { setActive(ws.id); setShowWsMenu(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                      ws.id === activeId ? "bg-hover text-text font-medium" : "text-text hover:bg-hover"
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] text-dim">{ws.item_count}</span>
                  </button>
                ))}
                <button onClick={async () => {
                    const name = prompt("Workspace name:");
                    if (name) await createWorkspace(sessionId, name);
                    setShowWsMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-text hover:bg-hover transition-colors border-t border-border"
                >
                  + New Workspace
                </button>
              </div>
            )}
          </div>
          {workspace && (
            <button onClick={startEdit}
              className="p-0.5 rounded text-dim opacity-0 group-hover/title:opacity-100 hover:text-text transition-all"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
        {editing && (
          <div className="flex items-center gap-1 mt-1">
            <input type="text" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 bg-hover border border-border rounded px-2 py-0.5 text-xs text-text outline-none focus:border-text"
            />
            <button onClick={saveEdit} className="p-0.5 rounded text-dim hover:text-text"><Check size={12} /></button>
            <button onClick={() => setEditing(false)} className="p-0.5 rounded text-dim hover:text-text"><X size={12} /></button>
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted">{workspace?.item_count ?? 0} items</span>
          {workspace && workspace.item_count > 0 && (
            <button onClick={(e) => { e.stopPropagation(); onChatClick(); }}
              className="flex items-center gap-1 text-[10px] text-text hover:text-muted transition-colors"
            >
              <MessageCircle size={10} />
              Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useWorkspaceStore((s) => s.items);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const loadItems = useWorkspaceStore((s) => s.loadItems);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
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
    <div className="h-full flex flex-col">
      {/* Coming soon banner */}
      <div className="shrink-0 px-3 py-1.5 bg-hover border-b border-border flex items-center gap-1.5 text-[10px] text-text">
        <Construction size={11} />
        <span>Canvas & Station views — coming soon</span>
      </div>

      <WorkspaceHeader workspace={activeWs} sessionId={sessionId} onChatClick={() => setChatOpen(true)} />

      <div ref={setNodeRef}
        className={`flex-1 overflow-y-auto transition-all ${
          isOver ? "bg-hover border-2 border-dashed border-border" : ""
        }`}
      >
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="size-5 border-2 border-text border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="px-3 py-2 m-3 text-xs text-text bg-hover border border-border rounded">{error}</div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="size-8 rounded bg-panel border border-border flex items-center justify-center mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-xs text-muted max-w-xs">
              Drag search results here to save them for later
            </p>
            {!activeWs && (
              <button onClick={() => {
                  const name = prompt("Workspace name:");
                  if (name) createWorkspace(sessionId, name);
                }}
                className="mt-3 text-xs px-3 py-1.5 rounded bg-text text-surface hover:bg-text/80 transition-colors"
              >
                Create Workspace
              </button>
            )}
          </div>
        )}
        {items.length > 0 && (
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="space-y-1 p-2">
              {items.map((item) => (
                <WorkspaceItemCard key={item.id} item={item} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
      {chatOpen && activeId && (
        <ChatModal workspaceId={activeId} workspaceName={activeWs?.name} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}
