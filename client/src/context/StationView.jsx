import {
  Book, Check, ExternalLink, Layers, MessageCircle,
  Pencil, Pin, Plus, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import { useUIStore } from "../stores/uiStore";
import ChatModal from "../components/ChatModal";

// ── Helpers ──────────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function Favicon({ domain }) {
  return (
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt=""
      className="size-4 rounded shrink-0"
      onError={(e) => (e.target.style.display = "none")}
    />
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mb-3">
        <Icon size={16} className="text-dim" />
      </div>}
      <p className="text-xs text-muted max-w-xs">{message}</p>
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-12"><div className="size-4 border-2 border-text border-t-transparent rounded-full animate-spin" /></div>;
}

// ── Workspace Header ─────────────────────────────────────────────────────

function WorkspaceHeader({ workspace, sessionId, onChatClick }) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const openCreateWsModal = useUIStore((s) => s.openCreateWsModal);
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
    <div className="shrink-0 px-4 py-3 border-b border-border/80 bg-surface/50 backdrop-blur-md flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center gap-2 text-sm font-bold text-text hover:text-violet-300 transition-colors font-heading"
            >
              <span className="truncate max-w-36">{workspace?.name || "Workspace"}</span>
              <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-mono">{workspace?.item_count ?? 0}</span>
            </button>
            {showWsMenu && (
              <div className="absolute top-full left-0 mt-2 w-52 rounded-2xl bg-elevated/95 backdrop-blur-xl border border-border/80 shadow-2xl overflow-hidden z-30 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-3.5 py-2 text-[10px] text-muted font-bold tracking-wider uppercase border-b border-border/80 font-heading">Workspaces</div>
                {workspaces.map((ws) => (
                  <button key={ws.id}
                    onClick={() => { setActive(ws.id); setShowWsMenu(false); }}
                    className={`w-full px-3.5 py-2 text-left text-xs font-medium transition-colors flex items-center justify-between ${
                      ws.id === activeId ? "bg-violet-500/15 text-violet-300 font-semibold" : "text-text hover:bg-hover"
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] text-dim">{ws.item_count}</span>
                  </button>
                ))}
                <button onClick={() => {
                    openCreateWsModal();
                    setShowWsMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-violet-400 hover:bg-hover transition-colors border-t border-border/80 flex items-center gap-1.5"
                >+ New Workspace</button>
                <button onClick={async () => {
                    if (confirm(`Delete workspace "${workspace?.name}"? This cannot be undone.`)) {
                      await deleteWorkspace(sessionId, workspace?.id);
                      const remaining = workspaces.filter((w) => w.id !== workspace?.id);
                      if (remaining.length > 0) setActive(remaining[0].id);
                      setShowWsMenu(false);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >Delete Workspace</button>
              </div>
            )}
          </div>
          {workspace && (
            <button onClick={startEdit}
              className="p-1 rounded-md text-dim opacity-0 group-hover/title:opacity-100 hover:text-text hover:bg-hover transition-all"
            ><Pencil size={12} /></button>
          )}
        </div>
        {editing && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <input type="text" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 bg-hover border border-border rounded-lg px-2.5 py-1 text-xs text-text outline-none focus:border-violet-500"
            />
            <button onClick={saveEdit} className="p-1 rounded text-emerald-400 hover:bg-hover"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded text-dim hover:text-text"><X size={13} /></button>
          </div>
        )}
      </div>
      <button onClick={onChatClick}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-all shadow-sm"
      ><MessageCircle size={13} /> Chat Assistant</button>
    </div>
  );
}

// ── Search Bar ───────────────────────────────────────────────────────────

function SearchBar({ value, onChange }) {
  return (
    <div className="shrink-0 px-3.5 py-2.5 border-b border-border/80 bg-surface/30">
      <div className="relative input-glow-focus rounded-xl">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Filter sources, notes, summaries..."
          className="w-full h-8 pl-8 pr-3 rounded-xl bg-panel/80 border border-border/80 text-xs text-text outline-none placeholder:text-dim transition-all focus:border-violet-500/60"
        />
      </div>
    </div>
  );
}

// ── Pinned Chips ─────────────────────────────────────────────────────────

function PinnedChips({ pins, sessionId, wsId, onDeletePin }) {
  if (pins.length === 0) return null;
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 border-b border-border/80 overflow-x-auto bg-violet-500/5">
      <Pin size={12} className="text-violet-400 shrink-0" />
      {pins.map((p) => (
        <span key={p.id}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-panel border border-violet-500/30 text-[10px] font-medium text-text shrink-0 shadow-sm"
        >
          <span className="capitalize text-violet-300">{p.pinnable_type}</span>
          <span className="text-dim max-w-20 truncate">{p.pinnable_id}</span>
          <button onClick={() => onDeletePin(p.id)}
            className="p-0.5 rounded-full text-dim hover:text-text hover:bg-hover transition-colors"
          ><X size={9} /></button>
        </span>
      ))}
    </div>
  );
}

// ── Source Tall Card ─────────────────────────────────────────────────────

function SourceTallCard({ item, type, sessionId, wsId, isPinned, onPin, onUnpin }) {
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);

  return (
    <div className="group shrink-0 w-48 h-48 rounded-2xl glass-card flex flex-col overflow-hidden hover:border-violet-500/50 transition-all duration-300 shadow-md">
      {/* Preview area */}
      <div className="h-24 shrink-0 bg-surface/80 flex items-center justify-center overflow-hidden relative">
        {(type === "image" || type === "video") && item.url ? (
          <img src={type === "video" ? item.thumbnail : item.url} alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <Layers size={26} className="text-dim opacity-30 group-hover:scale-110 transition-transform" />
        )}
        <button onClick={() => isPinned ? onUnpin(item.id) : onPin(type, item.id)}
          className={`absolute top-1.5 right-1.5 p-1.5 rounded-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 ${
            isPinned ? "bg-violet-600 text-white shadow-md shadow-violet-500/30" : "bg-black/60 text-white hover:bg-black/80"
          }`}
          title={isPinned ? "Unpin" : "Pin"}
        ><Pin size={11} /></button>
      </div>
      {/* Info area */}
      <div className="flex-1 px-3 py-2.5 min-w-0 flex flex-col justify-between">
        <p className="text-xs font-semibold text-text truncate group-hover:text-violet-300 transition-colors">{item.title || "Untitled"}</p>
        <div className="flex items-center gap-1 mt-1">
          {item.url ? (
            <>
              <Favicon domain={getHostname(item.url)} />
              <span className="text-[10px] text-muted truncate flex-1">{getHostname(item.url)}</span>
              <button onClick={() => window.open(item.url, "_blank")}
                className="p-1 rounded-md text-muted hover:text-text hover:bg-hover transition-colors shrink-0"
              ><ExternalLink size={10} /></button>
            </>
          ) : (
            <span className="text-[10px] text-muted truncate flex-1">{item.caption || item.platform || ""}</span>
          )}
          <button onClick={() => { if (item.url) openSummarizer(item.url, item.title); }}
            className="p-1 rounded-md text-muted hover:text-cyan-300 hover:bg-hover transition-colors shrink-0"
            title="Summarize"
          ><Sparkles size={10} /></button>
          <button onClick={() => { if (item.url) openReader(item.url, item.title); }}
            className="p-1 rounded-md text-muted hover:text-violet-300 hover:bg-hover transition-colors shrink-0"
            title="Reader"
          ><Book size={10} /></button>
        </div>
      </div>
    </div>
  );
}

// ── Notes Section (with pin) ─────────────────────────────────────────────

function NotesSection({ notes, sessionId, wsId, pins, onCreateNote, onUpdateNote, onDeleteNote, onPin, onUnpin }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!title.trim()) return;
    await onCreateNote(sessionId, wsId, title.trim(), content);
    setTitle("");
    setContent("");
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content || "");
  };

  const handleUpdate = async (noteId) => {
    if (!editTitle.trim()) return;
    await onUpdateNote(sessionId, wsId, noteId, { title: editTitle.trim(), content: editContent });
    setEditingId(null);
  };

  const isPinned = (noteId) => pins.some((p) => p.pinnable_type === "note" && p.pinnable_id === noteId);

  return (
    <div className="border-t border-border">
      <div className="px-3 py-2 space-y-2">
        <h3 className="text-xs font-semibold text-text">Notes</h3>
        <div className="flex gap-2">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title..." maxLength={500}
            className="flex-1 bg-hover border border-border rounded px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim"
          />
          <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Content..."
            className="flex-[2] bg-hover border border-border rounded px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim"
          />
          <button onClick={handleAdd} disabled={!title.trim()}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30 shrink-0"
          ><Plus size={12} /> Add</button>
        </div>
      </div>
      <div className="px-3 pb-2 space-y-1">
        {notes.length === 0 && <p className="text-[10px] text-dim text-center py-4">No notes yet</p>}
        {notes.map((n) => {
          const pinned = isPinned(n.id);
          return (
            <div key={n.id} className="bg-panel border border-border rounded-md px-3 py-2">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
                  />
                  <input type="text" value={editContent} onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleUpdate(n.id)}
                      className="text-xs px-2 py-0.5 rounded bg-text text-surface hover:opacity-80 transition-opacity"
                    ><Check size={11} className="inline" /> Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-0.5 rounded border border-border text-dim hover:text-text transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text">{n.title}</span>
                    {n.content && <p className="text-xs text-text leading-relaxed mt-0.5 whitespace-pre-line">{n.content}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => pinned ? onUnpin(n.id) : onPin("note", n.id)}
                      className={`p-1 rounded transition-all ${pinned ? "text-text" : "text-dim hover:text-text hover:bg-hover"}`}
                      title={pinned ? "Unpin" : "Pin"}
                    ><Pin size={11} /></button>
                    <button onClick={() => startEdit(n)}
                      className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
                    ><Pencil size={11} /></button>
                    <button onClick={() => onDeleteNote(sessionId, wsId, n.id)}
                      className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
                    ><Trash2 size={11} /></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Compare Panel ────────────────────────────────────────────────────────

function ComparePanel({ sources, onClose }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const srcA = sources.find((s) => s.id === a);
  const srcB = sources.find((s) => s.id === b);

  if (!a || !b || !srcA || !srcB) {
    return (
      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text">Compare Sources</h3>
          <button onClick={onClose} className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"><X size={12} /></button>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <select value={a} onChange={(e) => setA(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">Select source A...</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
          </select>
          <span className="text-[10px] text-dim shrink-0">vs</span>
          <select value={b} onChange={(e) => setB(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">Select source B...</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const renderPreview = (src) => {
    const type = src._type || "page";
    if (type === "image") {
      return src.url ? <img src={src.url} alt="" className="w-full h-24 object-cover rounded" onError={(e) => { e.target.style.display = "none"; }} /> : null;
    }
    if (type === "video" && src.thumbnail) {
      return <img src={src.thumbnail} alt="" className="w-full h-24 object-cover rounded" onError={(e) => { e.target.style.display = "none"; }} />;
    }
    return null;
  };

  return (
    <div className="border-t border-border">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text">Compare Sources</h3>
          <button onClick={onClose} className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"><X size={12} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-text truncate">{srcA.title || "Untitled"}</h4>
            <div className="text-[10px] text-dim">{srcA.url ? getHostname(srcA.url) : srcA._type}</div>
            {renderPreview(srcA)}
            {srcA.snippet && <p className="text-[10px] text-muted leading-relaxed">{srcA.snippet}</p>}
            {srcA.summary && <div><Sparkles size={10} className="inline text-dim mr-1" /><p className="text-[10px] text-text leading-relaxed mt-0.5">{srcA.summary}</p></div>}
            {srcA.notes && <p className="text-[10px] text-dim italic mt-0.5">{srcA.notes}</p>}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-text truncate">{srcB.title || "Untitled"}</h4>
            <div className="text-[10px] text-dim">{srcB.url ? getHostname(srcB.url) : srcB._type}</div>
            {renderPreview(srcB)}
            {srcB.snippet && <p className="text-[10px] text-muted leading-relaxed">{srcB.snippet}</p>}
            {srcB.summary && <div><Sparkles size={10} className="inline text-dim mr-1" /><p className="text-[10px] text-text leading-relaxed mt-0.5">{srcB.summary}</p></div>}
            {srcB.notes && <p className="text-[10px] text-dim italic mt-0.5">{srcB.notes}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Station View ───────────────────────────────────────────────────

export default function StationView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useWorkspaceStore((s) => s.items);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const loadItems = useWorkspaceStore((s) => s.loadItems);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const station = useWorkspaceStationStore();
  const stationError = station.error;

  const [searchQuery, setSearchQuery] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (activeId) {
      loadItems(sessionId, activeId);
      station.loadAll(sessionId, activeId);
    }
  }, [activeId, sessionId]);

  const activeWs = workspaces.find((w) => w.id === activeId);

  const { setNodeRef, isOver } = useDroppable({
    id: "workspace-drop",
    data: { type: "workspace" },
  });

  const allSources = [
    ...items.map((i) => ({ ...i, _type: "page" })),
    ...station.images.map((img) => ({ ...img, _type: "image" })),
    ...station.videos.map((v) => ({ ...v, _type: "video" })),
  ];

  const filteredSources = searchQuery.trim()
    ? allSources.filter((s) =>
        (s.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.snippet || s.caption || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSources;

  const filteredNotes = searchQuery.trim()
    ? station.notes.filter((n) =>
        (n.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : station.notes;

  const handlePin = useCallback(async (type, id) => {
    if (!activeId) return;
    const pinType = type === "page" ? "item" : type;
    await station.createPin(sessionId, activeId, pinType, id);
    await station.loadAll(sessionId, activeId);
  }, [activeId, sessionId, station]);

  const handleUnpin = useCallback(async (id) => {
    const pin = station.pins.find((p) => p.pinnable_id === id);
    if (pin) await station.deletePin(sessionId, activeId, pin.id);
    await station.loadAll(sessionId, activeId);
  }, [activeId, sessionId, station]);

  const handleCreateNote = useCallback(async (sid, wsId, title, content) => {
    await station.createNote(sid, wsId, title, content);
  }, [station]);

  const handleUpdateNote = useCallback(async (sid, wsId, noteId, data) => {
    await station.updateNote(sid, wsId, noteId, data);
  }, [station]);

  const handleDeleteNote = useCallback(async (sid, wsId, noteId) => {
    await station.deleteNote(sid, wsId, noteId);
  }, [station]);

  const openCreateWsModal = useUIStore((s) => s.openCreateWsModal);

  if (!activeWs) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mb-3">
          <Layers size={16} className="text-dim" />
        </div>
        <p className="text-xs text-muted max-w-xs mb-3">Select or create a workspace to get started</p>
        <button onClick={openCreateWsModal}
          className="text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md hover:opacity-90 transition-opacity"
        >Create Workspace</button>
      </div>
    );
  }

  const isPinned = (type, id) => {
    const pinType = type === "page" ? "item" : type;
    return station.pins.some((p) => p.pinnable_type === pinType && p.pinnable_id === id);
  };

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader workspace={activeWs} sessionId={sessionId} onChatClick={() => setChatOpen(true)} />

      <div ref={setNodeRef} className={`flex-1 overflow-y-auto ${isOver ? "bg-hover" : ""}`}>
        {(error || stationError) && (
          <div className="px-3 py-1.5 mx-2 mt-2 text-[10px] text-text bg-hover rounded">{error || stationError}</div>
        )}

        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        <PinnedChips pins={station.pins} sessionId={sessionId} wsId={activeId} onDeletePin={async (pinId) => { await station.deletePin(sessionId, activeId, pinId); await station.loadAll(sessionId, activeId); }} />

        {/* Sources row */}
        <div className="border-b border-border">
          {loading && allSources.length === 0 ? (
            <Spinner />
          ) : searchQuery.trim() && filteredSources.length === 0 ? (
            <div className="px-3 py-6"><EmptyState icon={Search} message="No sources match your search" /></div>
          ) : filteredSources.length > 0 ? (
            <>
              <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-text mb-2">Sources</h3>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filteredSources.map((s) => (
                    <SourceTallCard key={s.id} item={s} type={s._type}
                      sessionId={sessionId} wsId={activeId}
                      isPinned={isPinned(s._type, s.id)}
                      onPin={handlePin} onUnpin={handleUnpin}
                    />
                  ))}
                </div>
              </div>
              {items.filter((i) => i.summary).length > 0 && (
                <div className="px-3 pb-2 space-y-1">
                  {items.filter((i) => i.summary).map((item) => (
                    <div key={item.id} className="bg-panel border border-border rounded-md px-3 py-2">
                      <div className="flex items-center gap-1.5 text-xs text-text">
                        <Sparkles size={11} />
                        <span className="font-medium truncate">{item.title || "Untitled"}</span>
                      </div>
                      <p className="text-[10px] text-text leading-relaxed mt-1 whitespace-pre-line">{item.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-6"><EmptyState icon={Layers} message="Add sources to your workspace from Search Assist" /></div>
          )}
        </div>

        {/* Notes */}
        {searchQuery.trim() && filteredNotes.length === 0 && filteredSources.length === 0 ? null : (
          <NotesSection notes={filteredNotes} sessionId={sessionId} wsId={activeId}
            pins={station.pins}
            onCreateNote={handleCreateNote} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote}
            onPin={handlePin} onUnpin={handleUnpin}
          />
        )}

        {/* AI Tools + Compare */}
        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-text text-surface hover:opacity-80 transition-opacity"
            ><MessageCircle size={12} /> Chat</button>
            <button onClick={() => setCompareOpen(!compareOpen)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${
                compareOpen ? "bg-hover text-text border-text/40" : "border-border text-text hover:bg-hover"
              }`}
            >Compare</button>
          </div>
        </div>

        {compareOpen && (
          <ComparePanel sources={allSources} onClose={() => setCompareOpen(false)} />
        )}
      </div>

      {chatOpen && <ChatModal workspaceId={activeId} workspaceName={activeWs?.name} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
