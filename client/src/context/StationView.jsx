import {
  Book, Check, ExternalLink, Layers,
  Pencil, Pin, Plus, Scale, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import { useUIStore } from "../stores/uiStore";
import { SkeletonTallCard } from "../components/Skeleton";

// ── Helpers ──────────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function Favicon({ domain }) {
  return (
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt=""
      className="size-4 rounded-md shrink-0"
      onError={(e) => (e.target.style.display = "none")}
    />
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mb-3">
        <Icon size={16} className="text-dim" />
      </div>}
      <p className="text-xs text-muted max-w-xs">{message}</p>
    </div>
  );
}

// ── Workspace Header ─────────────────────────────────────────────────────

function WorkspaceHeader({ workspace, sessionId, searchQuery, onSearchChange }) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
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
    <div className="shrink-0 px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center gap-2 text-sm font-semibold text-text hover:text-muted transition-colors text-left"
            >
              <span>{workspace?.name || "Workspace"}</span>
              <span className="text-xs text-dim shrink-0">{workspace?.item_count ?? 0}</span>
            </button>
            {showWsMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-elevated border border-border shadow-pop overflow-hidden z-10">
                <div className="px-3 py-2 text-base text-muted font-medium border-b border-border">Workspaces</div>
                {workspaces.map((ws) => (
                  <button key={ws.id}
                    onClick={() => { setActive(ws.id); setShowWsMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                      ws.id === activeId ? "bg-hover text-text" : "text-text hover:bg-hover"
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-base text-dim">{ws.item_count}</span>
                  </button>
                ))}
                <button onClick={async () => {
                    const name = prompt("Workspace name:");
                    if (name) await createWorkspace(sessionId, name);
                    setShowWsMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-text hover:bg-hover transition-colors border-t border-border"
                >+ New Workspace</button>
                <button onClick={async () => {
                    if (confirm(`Delete workspace "${workspace?.name}"? This cannot be undone.`)) {
                      await deleteWorkspace(sessionId, workspace?.id);
                      const remaining = workspaces.filter((w) => w.id !== workspace?.id);
                      if (remaining.length > 0) setActive(remaining[0].id);
                      setShowWsMenu(false);
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-hover transition-colors"
                >Delete Workspace</button>
              </div>
            )}
          </div>
          {workspace && (
            <button onClick={startEdit}
              className="p-1 rounded-md text-dim opacity-0 group-hover/title:opacity-100 hover:text-text transition-all"
            ><Pencil size={16} /></button>
          )}
        </div>
        {editing && (
          <div className="flex items-center gap-1 mt-1">
            <input type="text" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
            />
            <button onClick={saveEdit} className="p-1 rounded-md text-dim hover:text-text"><Check size={16} /></button>
            <button onClick={() => setEditing(false)} className="p-1 rounded-md text-dim hover:text-text"><X size={16} /></button>
          </div>
        )}
      </div>
      <div className="relative shrink-0 w-44">
        <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
        <input type="text" value={searchQuery || ""} onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full h-7 pl-8 pr-2 rounded-full bg-hover border border-border text-xs text-text outline-none placeholder:text-dim focus:border-text/50 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Pinned Chips ─────────────────────────────────────────────────────────

function PinnedChips({ pins, sessionId, wsId, onDeletePin }) {
  if (pins.length === 0) return null;
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-2 overflow-x-auto">
      <Pin size={16} className="text-dim shrink-0" />
      {pins.map((p) => (
        <span key={p.id}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-hover border border-border text-base text-text shrink-0"
        >
          <span className="capitalize">{p.pinnable_type}</span>
          <span className="text-dim max-w-20 truncate">{p.pinnable_id}</span>
          <button onClick={() => onDeletePin(p.id)}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"
          ><X size={16} /></button>
        </span>
      ))}
    </div>
  );
}

// ── Source Tall Card ─────────────────────────────────────────────────────

function SourceTallCard({ item, type, sessionId, wsId, isPinned, onPin, onUnpin, onDelete }) {
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const [imgFailed, setImgFailed] = useState(false);

  const thumbSrc = type === "video" ? item.thumbnail
    : type === "image" ? item.url
    : item.media_url;

  const previewAspect = type === "image" ? "aspect-square"
    : type === "video" ? "aspect-video"
    : "aspect-[4/3]";

  return (
    <div className="group w-full break-inside-avoid mb-3 bg-elevated rounded-xl shadow-raised overflow-hidden hover:shadow-pop transition-all">
      {/* Preview area */}
      <div className={`relative ${previewAspect} bg-hover flex items-center justify-center overflow-hidden`}>
        {thumbSrc && !imgFailed ? (
          <img src={thumbSrc} alt=""
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers size={24} className="text-dim opacity-40" />
          </div>
        )}
        <button onClick={() => isPinned ? onUnpin(item.id) : onPin(type, item.id)}
          className={`absolute top-2 right-1.5 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
            isPinned ? "bg-text text-surface" : "bg-surface/80 text-dim hover:text-text"
          }`}
          title={isPinned ? "Unpin" : "Pin"}
        ><Pin size={16} /></button>
      </div>
      {/* Info area */}
      <div className="px-3 py-3 min-w-0">
        <p className="text-sm font-medium text-text line-clamp-2 leading-snug">{item.title || "Untitled"}</p>
        {type === "page" && item.snippet && (
          <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{item.snippet}</p>
        )}
        <div className="flex items-center gap-1 mt-2">
          {item.url ? (
            <>
              <Favicon domain={getHostname(item.url)} />
              <span className="text-xs text-muted truncate flex-1">{getHostname(item.url)}</span>
            </>
          ) : (
            <span className="text-xs text-muted truncate flex-1">{item.caption || item.platform || ""}</span>
          )}
          <button onClick={() => window.open(item.url, "_blank")}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors shrink-0"
            title="Open"
          ><ExternalLink size={16} /></button>
          <button onClick={() => { if (item.url) openSummarizer(item.url, item.title); }}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors shrink-0"
            title="Summarize"
          ><Sparkles size={16} /></button>
          <button onClick={() => { if (item.url) openReader(item.url, item.title); }}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors shrink-0"
            title="Reader"
          ><Book size={16} /></button>
          {onDelete && (
            <button onClick={() => onDelete(item)}
              className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors shrink-0"
              title="Remove from workspace"
            ><Trash2 size={16} /></button>
          )}
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
    <div>
      <div className="px-3 py-2 space-y-2">
        <h3 className="text-xs font-semibold text-text">Notes</h3>
        <div className="flex gap-2">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title..." maxLength={500}
            className="flex-1 bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim"
          />
          <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Content..."
            className="flex-[2] bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim"
          />
          <button onClick={handleAdd} disabled={!title.trim()}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30 shrink-0"
          ><Plus size={16} /> Add</button>
        </div>
      </div>
      <div className="px-3 pb-2 space-y-1">
        {notes.length === 0 && <p className="text-base text-dim text-center py-4">No notes yet</p>}
        {notes.map((n) => {
          const pinned = isPinned(n.id);
          return (
            <div key={n.id} className="bg-elevated rounded-lg px-3 py-2 shadow-surface">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
                  />
                  <input type="text" value={editContent} onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleUpdate(n.id)}
                      className="text-xs px-2 py-1 rounded-md bg-text text-surface hover:opacity-80 transition-opacity"
                    ><Check size={16} className="inline" /> Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-1 rounded-md border border-border text-dim hover:text-text transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text">{n.title}</span>
                    {n.content && <p className="text-xs text-text leading-relaxed mt-1 whitespace-pre-line">{n.content}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => pinned ? onUnpin(n.id) : onPin("note", n.id)}
                      className={`p-1 rounded-md transition-all ${pinned ? "text-text" : "text-dim hover:text-text hover:bg-hover"}`}
                      title={pinned ? "Unpin" : "Pin"}
                    ><Pin size={16} /></button>
                    <button onClick={() => startEdit(n)}
                      className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
                    ><Pencil size={16} /></button>
                    <button onClick={() => onDeleteNote(sessionId, wsId, n.id)}
                      className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-all"
                    ><Trash2 size={16} /></button>
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

function snapshotSource(s) {
  return {
    _type: s._type, id: s.id, title: s.title, url: s.url, snippet: s.snippet,
    summary: s.summary, notes: s.notes, caption: s.caption, thumbnail: s.thumbnail,
  };
}

function ComparePanel({ sources, onClose, onSave }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const srcA = sources.find((s) => s.id === a);
  const srcB = sources.find((s) => s.id === b);

  if (!a || !b || !srcA || !srcB) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text">Compare Sources</h3>
          <button onClick={onClose} className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <select value={a} onChange={(e) => setA(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">Select source A...</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
          </select>
          <span className="text-base text-dim shrink-0">vs</span>
          <select value={b} onChange={(e) => setB(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
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
      return src.url ? <img src={src.url} alt="" className="w-full h-24 object-cover rounded-md" onError={(e) => { e.target.style.display = "none"; }} /> : null;
    }
    if (type === "video" && src.thumbnail) {
      return <img src={src.thumbnail} alt="" className="w-full h-24 object-cover rounded-md" onError={(e) => { e.target.style.display = "none"; }} />;
    }
    return null;
  };

  return (
    <div>
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text">Compare Sources</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => onSave?.(srcA, srcB)}
              className="flex items-center gap-1 text-base px-2 py-1 rounded-md bg-text text-surface hover:opacity-80 transition-opacity"
            ><Plus size={16} /> Save</button>
            <button onClick={onClose} className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"><X size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-text truncate">{srcA.title || "Untitled"}</h4>
            <div className="text-base text-dim">{srcA.url ? getHostname(srcA.url) : srcA._type}</div>
            {renderPreview(srcA)}
            {srcA.snippet && <p className="text-base text-muted leading-relaxed">{srcA.snippet}</p>}
            {srcA.summary && <div><Sparkles size={16} className="inline text-dim mr-1" /><p className="text-base text-text leading-relaxed mt-1">{srcA.summary}</p></div>}
            {srcA.notes && <p className="text-base text-dim italic mt-1">{srcA.notes}</p>}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-text truncate">{srcB.title || "Untitled"}</h4>
            <div className="text-base text-dim">{srcB.url ? getHostname(srcB.url) : srcB._type}</div>
            {renderPreview(srcB)}
            {srcB.snippet && <p className="text-base text-muted leading-relaxed">{srcB.snippet}</p>}
            {srcB.summary && <div><Sparkles size={16} className="inline text-dim mr-1" /><p className="text-base text-text leading-relaxed mt-1">{srcB.summary}</p></div>}
            {srcB.notes && <p className="text-base text-dim italic mt-1">{srcB.notes}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Saved Comparisons ────────────────────────────────────────────────────

function SavedComparisons({ comparisons, onDelete }) {
  const [openId, setOpenId] = useState(null);
  if (comparisons.length === 0) return null;
  return (
    <div className="px-3 py-2">
      <div className="space-y-1">
        {comparisons.map((c) => {
          const data = c.data;
          const open = openId === c.id;
          return (
            <div key={c.id} className="bg-elevated rounded-lg shadow-surface">
              <div className="flex items-center gap-2 px-3 py-2">
                <Scale size={16} className="text-dim shrink-0" />
                <button onClick={() => setOpenId(open ? null : c.id)}
                  className="flex-1 min-w-0 text-left text-xs text-text truncate hover:text-muted transition-colors"
                >{c.title}</button>
                <button onClick={() => onDelete(c.id)}
                  className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Delete comparison"
                ><Trash2 size={16} /></button>
              </div>
              {open && data?.type === "two-way" && data.sources?.length === 2 && (
                <div className="px-3 pb-3 pt-2 border-t border-border grid grid-cols-2 gap-3">
                  {data.sources.map((s, i) => (
                    <div key={i} className="space-y-1 min-w-0">
                      <p className="text-xs font-medium text-text truncate">{s.title || "Untitled"}</p>
                      <p className="text-base text-dim">{s.url ? getHostname(s.url) : s._type}</p>
                      {s.snippet && <p className="text-base text-muted leading-relaxed">{s.snippet}</p>}
                      {s.summary && <p className="text-base text-text leading-relaxed">{s.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  const station = useWorkspaceStationStore();
  const stationError = station.error;

  const [searchQuery, setSearchQuery] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sources");

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

  const handleSaveComparison = useCallback(async (srcA, srcB) => {
    if (!srcA || !srcB) return;
    const title = `${srcA.title || "Untitled"} vs ${srcB.title || "Untitled"}`;
    const data = { type: "two-way", sources: [snapshotSource(srcA), snapshotSource(srcB)] };
    await station.createComparison(sessionId, activeId, title, data);
  }, [station, sessionId, activeId]);

  const handleDeleteSource = useCallback(async (s) => {
    if (!s) return;
    if (s._type === "page") {
      await deleteItem(sessionId, s.id);
    } else if (s._type === "image") {
      await station.deleteImage(sessionId, activeId, s.id);
    } else if (s._type === "video") {
      await station.deleteVideo(sessionId, activeId, s.id);
    }
    await loadItems(sessionId, activeId);
    await station.loadAll(sessionId, activeId);
  }, [sessionId, activeId, station, deleteItem, loadItems]);

  if (!activeWs) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mb-3">
          <Layers size={16} className="text-dim" />
        </div>
        <p className="text-xs text-muted max-w-xs mb-3">Select or create a workspace to get started</p>
        <button onClick={() => { const name = prompt("Workspace name:"); if (name) createWorkspace(sessionId, name); }}
          className="text-xs px-3 py-2 rounded-md bg-text text-surface hover:opacity-80 transition-opacity"
        >Create Workspace</button>
      </div>
    );
  }

  const isPinned = (type, id) => {
    const pinType = type === "page" ? "item" : type;
    return station.pins.some((p) => p.pinnable_type === pinType && p.pinnable_id === id);
  };

  const TABS = [
    { id: "sources", label: "Sources", count: filteredSources.length },
    { id: "notes", label: "Notes", count: filteredNotes.length },
    { id: "comparisons", label: "Comparisons", count: station.comparisons.length },
  ];

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader workspace={activeWs} sessionId={sessionId}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
      />

      <div ref={setNodeRef} className={`flex-1 overflow-y-auto ${isOver ? "bg-hover" : ""}`}>
        {(error || stationError) && (
          <div className="px-3 py-2 mx-2 mt-2 text-base text-text bg-hover rounded-md">{error || stationError}</div>
        )}

        <PinnedChips pins={station.pins} sessionId={sessionId} wsId={activeId} onDeletePin={async (pinId) => { await station.deletePin(sessionId, activeId, pinId); await station.loadAll(sessionId, activeId); }} />

        {/* Section tabs */}
        <div className="shrink-0 flex items-center gap-1 px-3 py-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all active:scale-95 ${
                activeTab === t.id
                  ? "bg-text text-surface"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            >
              {t.label}
              <span className={`ml-1 ${activeTab === t.id ? "text-surface/70" : "text-dim"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div key={activeTab} className="animate-fade-in">
        {activeTab === "sources" && (
          <>
            {loading && allSources.length === 0 ? (
              <SkeletonTallCard count={6} />
            ) : searchQuery.trim() && filteredSources.length === 0 ? (
              <div className="px-3 py-6"><EmptyState icon={Search} message="No sources match your search" /></div>
            ) : filteredSources.length > 0 ? (
              <div>
                <div className="px-3 py-3">
                  <div className="columns-2 xl:columns-3 gap-3">
                    {filteredSources.map((s) => (
                      <SourceTallCard key={s.id} item={s} type={s._type}
                        sessionId={sessionId} wsId={activeId}
                        isPinned={isPinned(s._type, s.id)}
                        onPin={handlePin} onUnpin={handleUnpin}
                        onDelete={handleDeleteSource}
                      />
                    ))}
                  </div>
                </div>

                {items.filter((i) => i.summary).length > 0 && (
                  <div className="px-3 pb-2 space-y-1">
                    {items.filter((i) => i.summary).map((item) => (
                      <div key={item.id} className="bg-elevated rounded-lg px-3 py-2 shadow-surface">
                        <div className="flex items-center gap-2 text-xs text-text">
                          <Sparkles size={16} />
                          <span className="font-medium truncate">{item.title || "Untitled"}</span>
                        </div>
                        <p className="text-base text-text leading-relaxed mt-1 whitespace-pre-line">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                )}

                {compareOpen && (
                  <ComparePanel sources={allSources} onClose={() => setCompareOpen(false)} onSave={handleSaveComparison} />
                )}
              </div>
            ) : (
              <div className="px-3 py-6"><EmptyState icon={Layers} message="Add sources to your workspace from Search Assist" /></div>
            )}
          </>
        )}

        {activeTab === "notes" && (
          <NotesSection notes={filteredNotes} sessionId={sessionId} wsId={activeId}
            pins={station.pins}
            onCreateNote={handleCreateNote} onUpdateNote={handleUpdateNote} onDeleteNote={handleDeleteNote}
            onPin={handlePin} onUnpin={handleUnpin}
          />
        )}

        {activeTab === "comparisons" && (
          <div>
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-semibold text-text">
                Saved Comparisons
                <span className="ml-1 text-dim font-normal">{station.comparisons.length}</span>
              </h3>
              <button onClick={() => setCompareOpen(!compareOpen)}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium border transition-all active:scale-95 ${
                  compareOpen ? "bg-hover text-text border-text/40" : "border-border text-text hover:bg-hover"
                }`}
              ><Scale size={16} /> Compare</button>
            </div>

            {compareOpen && (
              <ComparePanel sources={allSources} onClose={() => setCompareOpen(false)} onSave={handleSaveComparison} />
            )}

            {station.comparisons.length === 0 ? (
              <div className="px-3 py-6"><EmptyState icon={Scale} message="Pick two sources with Compare to save a comparison here" /></div>
            ) : (
              <SavedComparisons comparisons={station.comparisons} onDelete={async (id) => { await station.deleteComparison(sessionId, activeId, id); }} />
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
