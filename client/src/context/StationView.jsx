import {
  Activity, BarChart2, Book, Check, ChevronDown, ChevronUp, Edit3, ExternalLink, Layers,
  Lightbulb, ListChecks, Pencil, Plus, Scale, Search, Sparkles,
  Target, TrendingUp, Trash2, X, MessageCircle, LayoutGrid, FileText,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import { useUIStore } from "../stores/uiStore";
import { SkeletonTallCard } from "../components/Skeleton";
import ChatModal from "../components/ChatModal";

// ── Helpers ──────────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function Favicon({ domain, size = 4 }) {
  return (
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 8}`} alt=""
      className={`size-${size} rounded-md shrink-0`}
      onError={(e) => { e.target.style.display = "none"; }}
    />
  );
}

function PagePlaceholder({ title }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-hover p-2">
      <FileText size={24} className="text-dim opacity-40 mb-2" />
      <p className="text-xs text-dim text-center truncate w-full px-1">{title || "Page"}</p>
      <div className="mt-2 space-y-1.5 w-full">
        <div className="h-2 bg-border/50 rounded w-3/4" />
        <div className="h-2 bg-border/50 rounded w-1/2" />
        <div className="h-2 bg-border/50 rounded w-5/6" />
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && <div className="size-10 rounded-xl bg-elevated flex items-center justify-center mb-3 shadow-card">
        <Icon size={20} className="text-dim" />
      </div>}
      <p className="text-sm text-muted max-w-xs mb-4">{message}</p>
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-text text-surface hover:opacity-85 transition-opacity"
        >{actionLabel}</button>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return null; }
}



// ── Source Card (Rich) ─────────────────────────────────────────────────────

function SourceCard({ item, type, isPinned, onPin, onDelete, onReader, onSummary }) {
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addItem = useWorkspaceStore((s) => s.addItem);

  const handleAddToWorkspace = useCallback((e) => {
    e.stopPropagation();
    if (!activeId) return;
    addItem(sessionId, activeId, item.url, item.title, item.snippet, item.source, item.media_url);
  }, [item, sessionId, activeId, addItem]);

  const thumbSrc = type === "video" ? item.thumbnail : type === "image" ? item.url : item.media_url;
  const domain = getHostname(item.url || "");
  const updatedAt = formatDate(item.updated_at || item.created_at);
  const isPage = type === "page";
  const [natRatio, setNatRatio] = useState(null);
  const imgAspect = type === "image" && natRatio ? Math.min(2.2, Math.max(0.5, natRatio)) : null;

  return (
    <div className={`group rounded-xl bg-panel shadow-card border border-border hover:shadow-card-hover transition-all duration-slow ease-out overflow-hidden ${isPage ? "max-w-xs shrink-0" : "shrink-0"}`}>
      <div
        className={`relative overflow-hidden bg-hover ${type === "video" ? "aspect-video" : "aspect-[4/3]"}`}
        style={imgAspect ? { aspectRatio: `${imgAspect}` } : undefined}
      >
        {thumbSrc ? (
          <img src={thumbSrc} alt=""
            className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
            onLoad={(e) => {
              if (type !== "image") return;
              const w = e.target.naturalWidth;
              const h = e.target.naturalHeight;
              if (w && h) setNatRatio(w / h);
            }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : isPage && domain ? (
          <div className="w-full h-full flex items-center justify-center bg-hover">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=256`}
              alt=""
              className="w-full h-full object-contain p-2"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          </div>
        ) : isPage ? (
          <PagePlaceholder title={item.title} />
        ) : (
          <Layers size={28} className="text-dim opacity-40" />
        )}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onDelete(item.id, type)}
            className="size-6 rounded-md bg-surface/90 backdrop-blur-sm text-dim hover:text-red-500 hover:bg-hover flex items-center justify-center shadow-card transition-all"
            title="Remove from workspace"
          ><Trash2 size={12} /></button>
        </div>
      </div>

      <div className="p-2.5 space-y-1.5">
        <h3 className="text-sm font-medium text-text line-clamp-2 leading-snug">
          {item.title || item.caption || "Untitled"}
        </h3>

        {isPage && item.snippet && (
          <p className="text-xs text-dim line-clamp-2 leading-relaxed">{item.snippet}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs">
          {domain ? <Favicon domain={domain} size={3} /> : null}
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent truncate flex-1 hover:underline"
              title={item.url}
            >{domain || item.url}</a>
          ) : (
            <span className="text-dim truncate flex-1">{item.platform || type}</span>
          )}
          {!isPage && updatedAt && <span className="text-dim">· {updatedAt}</span>}
        </div>

        {isPage && item.url && (
          <div className="flex items-center gap-1 pt-1 border-t border-border/50">
            <button onClick={() => onReader(item.url, item.title)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs text-dim hover:text-text hover:bg-elevated transition-colors"
              title="Reader"
            ><Book size={12} /> Read</button>
            <button onClick={() => onSummary(item.url, item.title)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs text-dim hover:text-text hover:bg-elevated transition-colors"
              title="Summarize"
            ><Sparkles size={12} /> Summarize</button>
            <button onClick={() => item.url && window.open(item.url, "_blank")}
              className="p-1.5 rounded-md text-dim hover:text-text hover:bg-elevated transition-colors"
              title="Open"
            ><ExternalLink size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Note Card ──────────────────────────────────────────────────────────────

function NoteCard({ note, onDelete, onEdit }) {
  const updatedAt = formatDate(note.updated_at || note.created_at);

  return (
    <div className="group rounded-xl bg-panel shadow-card border border-border hover:shadow-card-hover transition-all duration-slow ease-out p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text line-clamp-2 leading-snug flex-1">
          {note.title || "Untitled note"}
        </h3>
      </div>
      {note.content && (
        <p className="text-xs text-dim mt-2 leading-relaxed whitespace-pre-line">
          {note.content}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        {updatedAt && <span className="text-xs text-dim">{updatedAt}</span>}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(note)}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"
            title="Edit"
          ><Pencil size={14} /></button>
          <button onClick={() => onDelete(note.id)}
            className="p-1 rounded-md text-dim hover:text-red-500 hover:bg-hover transition-colors"
            title="Delete"
          ><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// ── Comparison Card ───────────────────────────────────────────────────────

function ComparisonCard({ comp, onDelete }) {
  const data = comp.data;
  const s1 = data?.sources?.[0];
  const s2 = data?.sources?.[1];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-xl bg-panel shadow-card border border-border hover:shadow-card-hover transition-all duration-slow ease-out overflow-hidden">
      <div className="p-3">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between gap-2 text-left"
          title={expanded ? "Collapse" : "Expand"}
        >
          <h3 className="text-sm font-medium text-text line-clamp-2 leading-snug">{comp.title || "Comparison"}</h3>
          {expanded ? <ChevronUp size={14} className="text-dim shrink-0" /> : <ChevronDown size={14} className="text-dim shrink-0" />}
        </button>
        {expanded && s1 && s2 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-hover rounded-md p-3 min-w-0">
              <p className="font-medium text-text truncate mb-2">{s1.title || "Untitled"}</p>
              <p className="text-dim text-xs truncate mb-2">{s1.url ? getHostname(s1.url) : s1._type}</p>
              {s1.snippet && <p className="text-dim text-xs leading-relaxed">{s1.snippet}</p>}
              {s1.summary && <p className="text-text text-xs mt-2 leading-relaxed">{s1.summary}</p>}
              {s1.notes && <p className="text-dim text-xs mt-2 leading-relaxed">{s1.notes}</p>}
              {s1.url && (
                <a href={s1.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
                ><ExternalLink size={12} /> Open</a>
              )}
            </div>
            <div className="bg-hover rounded-md p-3 min-w-0">
              <p className="font-medium text-text truncate mb-2">{s2.title || "Untitled"}</p>
              <p className="text-dim text-xs truncate mb-2">{s2.url ? getHostname(s2.url) : s2._type}</p>
              {s2.snippet && <p className="text-dim text-xs leading-relaxed">{s2.snippet}</p>}
              {s2.summary && <p className="text-text text-xs mt-2 leading-relaxed">{s2.summary}</p>}
              {s2.notes && <p className="text-dim text-xs mt-2 leading-relaxed">{s2.notes}</p>}
              {s2.url && (
                <a href={s2.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
                ><ExternalLink size={12} /> Open</a>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-border bg-hover/50">
        <button onClick={() => onDelete(comp.id)}
          className="p-1.5 rounded-md text-dim hover:text-red-500 hover:bg-hover transition-colors"
          title="Delete comparison"
        ><Trash2 size={14} /></button>
      </div>
    </div>
  );
}



// ── Workspace Header (Search + Tabs) ───────────────────────────────────────

function WorkspaceHeader({ workspace, sessionId, searchQuery, onSearchChange, mode, setMode, chatOpen, setChatOpen }) {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const [showWsMenu, setShowWsMenu] = useState(false);

  return (
    <div className="shrink-0 px-3 py-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-0">
          <button onClick={() => setShowWsMenu(!showWsMenu)}
            className="flex items-center gap-2 text-sm font-semibold text-text hover:text-muted transition-colors text-left w-full"
          >
            <span className="truncate">{workspace?.name || "Workspace"}</span>
            <span className="text-xs text-dim shrink-0">{workspace?.item_count ?? 0}</span>
          </button>
          {showWsMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-panel border border-border shadow-pop overflow-hidden z-10">
              <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border">Workspaces</div>
              {workspaces.map((ws) => (
                <button key={ws.id}
                  onClick={() => { setActive(ws.id); setShowWsMenu(false); }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                    ws.id === activeId ? "bg-hover text-text" : "text-text hover:bg-hover"
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  <span className="text-sm text-dim">{ws.item_count}</span>
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
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
            <input type="text" value={searchQuery || ""} onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sources, notes..."
              className="w-[280px] h-9 pl-8 pr-2 rounded-lg bg-panel border border-border text-xs text-text outline-none placeholder:text-dim focus:border-text/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-elevated border border-border rounded-md p-1">
            <button onClick={() => setMode("station")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "station"
                  ? "bg-text text-surface shadow-surface"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            ><LayoutGrid size={14} /></button>
            <button onClick={() => setMode("canvas")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === "canvas"
                  ? "bg-text text-surface shadow-surface"
                  : "text-muted hover:text-text hover:bg-hover"
              }`}
            ><FileText size={14} /></button>
          </div>
          <button onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted hover:text-text hover:bg-hover transition-colors"
            title="Chat about this workspace"
          ><MessageCircle size={14} /> Chat</button>
        </div>
      </div>
    </div>
  );
}

// ── Section Card Wrapper ───────────────────────────────────────────────────

function SectionCard({ icon: Icon, label, count, children, emptyMessage, emptyIcon }) {
  return (
    <div className="mx-3 mb-4 rounded-xl bg-elevated shadow-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          {Icon && <Icon size={16} className="text-accent" />}
          <span>{label}</span>
          {count > 0 && <span className="text-xs font-normal text-dim">({count})</span>}
        </h3>
      </div>
      <div className="p-3">
        {children?.length === 0 || !children ? (
          <EmptyState icon={emptyIcon || Icon} message={emptyMessage} />
        ) : children}
      </div>
    </div>
  );
}

// ── Source Collections ────────────────────────────────────────────────────

function SourceCollections({ images, videos, notes, comparisons, onPin, onDelete, onReader, onSummary }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl bg-elevated shadow-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <Layers size={16} className="text-accent" /> Media Collections
        </h3>
        <button onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors"
        >
          {expanded ? <X size={14} /> : null}
        </button>
      </div>
      {expanded && (
        <div className="p-3 space-y-4">
          {images.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-dim mb-2">Images ({images.length})</h4>
              <div className="columns-2 gap-2">
                {images.map((img) => (
                  <SourceCard key={img.id} item={img} type="image"
                    isPinned={false} onPin={onPin} onDelete={onDelete} onReader={onReader} onSummary={onSummary}
                  />
                ))}
              </div>
            </div>
          )}
          {videos.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-dim mb-2">Videos ({videos.length})</h4>
              <div className="columns-2 gap-2">
                {videos.map((vid) => (
                  <SourceCard key={vid.id} item={vid} type="video"
                    isPinned={false} onPin={onPin} onDelete={onDelete} onReader={onReader} onSummary={onSummary}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotesSection({ notes, sessionId, wsId, pins, onCreateNote, onUpdateNote, onDeleteNote, onPin, onUnpin, searchQuery }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const filteredNotes = searchQuery.trim()
    ? notes.filter((n) =>
        (n.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.content || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <>
      <div className="px-3 pb-2">
        <div className="flex gap-2 mb-2">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Title..." maxLength={500}
            className="flex-1 bg-panel border border-border rounded-md px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Content..."
            className="flex-1 bg-panel border border-border rounded-md px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim"
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleAdd} disabled={!title.trim()}
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30 shrink-0"
          ><Plus size={14} /> Add</button>
        </div>
      </div>
      <div className="px-3 pb-3 space-y-2">
        {filteredNotes.length === 0 && (
          <p className="text-xs text-dim text-center py-6">No notes yet — capture your thoughts here</p>
        )}
        {filteredNotes.map((n) => {
          return (
            <div key={n.id} className="bg-panel rounded-lg px-3 py-2 shadow-surface border border-border">
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
                    ><Check size={14} className="inline" /> Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-1 rounded-md border border-border text-dim hover:text-text transition-colors"
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <NoteCard
                  note={n}
                  onDelete={onDeleteNote}
                  onEdit={() => startEdit(n)}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
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
  const [showCreate, setShowCreate] = useState(false);

  const srcA = sources.find((s) => s.id === a);
  const srcB = sources.find((s) => s.id === b);

  const handleCreate = () => {
    if (!srcA || !srcB || srcA.id === srcB.id) return;
    const title = `${srcA.title || "Untitled"} vs ${srcB.title || "Untitled"}`;
    const data = { type: "two-way", sources: [snapshotSource(srcA), snapshotSource(srcB)] };
    onSave(title, data);
    setShowCreate(false);
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <Scale size={16} className="text-accent" /> Compare Sources
        </h3>
        <button onClick={onClose} className="p-1 rounded-md text-dim hover:text-text"><X size={14} /></button>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <select value={a} onChange={(e) => setA(e.target.value)}
          className="flex-1 min-w-0 truncate bg-panel border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
        >
          <option value="">Source A...</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
        </select>
        <span className="text-sm text-dim shrink-0">vs</span>
        <select value={b} onChange={(e) => setB(e.target.value)}
          className="flex-1 min-w-0 truncate bg-panel border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
        >
          <option value="">Source B...</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
        </select>
      </div>
      {srcA && srcB && srcA.id !== srcB.id && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-hover rounded-md p-2 min-w-0">
            <p className="font-medium text-text truncate">{srcA.title || "Untitled"}</p>
            {srcA.snippet && <p className="text-dim mt-1 line-clamp-2">{srcA.snippet.slice(0, 80)}...</p>}
          </div>
          <div className="bg-hover rounded-md p-2 min-w-0">
            <p className="font-medium text-text truncate">{srcB.title || "Untitled"}</p>
            {srcB.snippet && <p className="text-dim mt-1 line-clamp-2">{srcB.snippet.slice(0, 80)}...</p>}
          </div>
        </div>
      )}
      <button onClick={handleCreate} disabled={!srcA || !srcB || srcA.id === srcB.id}
        className="w-full flex items-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30"
      ><Scale size={14} /> Create Comparison</button>
    </div>
  );
}

// ── Saved Comparisons ────────────────────────────────────────────────────

function SavedComparisons({ comparisons, onDelete }) {
  if (comparisons.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      {comparisons.map((c) => (
        <ComparisonCard key={c.id} comp={c} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ── Main Station View ────────────────────────────────────────────────────

export default function StationView({ mode, setMode, chatOpen, setChatOpen }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useWorkspaceStore((s) => s.items);
  const loading = useWorkspaceStore((s) => s.loading);
  const error = useWorkspaceStore((s) => s.error);
  const loadItems = useWorkspaceStore((s) => s.loadItems);
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const openReader = useUIStore((s) => s.openReader);

  const station = useWorkspaceStationStore();
  const stationError = station.error;

  const [searchQuery, setSearchQuery] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

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

  const sortedByDate = [...allSources].sort((a, b) => {
    const da = new Date(b.updated_at || b.created_at || "").getTime();
    const db = new Date(a.updated_at || a.created_at || "").getTime();
    return da - db;
  });

  const recentSources = searchQuery.trim()
    ? []
    : sortedByDate.slice(0, 4);

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

  const handlePin = useCallback(async (id, type) => {
    if (!activeId) return;
    const pinType = type === "page" ? "item" : type;
    await station.createPin(sessionId, activeId, pinType, id);
    await station.loadAll(sessionId, activeId);
  }, [activeId, sessionId, station]);

  const handleUnpin = useCallback(async (id, type) => {
    if (!activeId) return;
    const pinType = type === "page" ? "item" : type;
    const pin = station.pins.find((p) => p.pinnable_type === pinType && p.pinnable_id === id);
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

  const handleSaveComparison = useCallback(async (title, data) => {
    if (!activeId) return;
    await station.createComparison(sessionId, activeId, title, data);
    setCompareOpen(false);
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

  const handleDeleteComparison = useCallback(async (id) => {
    if (!activeId) return;
    await station.deleteComparison(sessionId, activeId, id);
    await station.loadAll(sessionId, activeId);
  }, [station, sessionId, activeId]);

  if (!activeWs) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="size-12 rounded-xl bg-elevated flex items-center justify-center mb-4 shadow-card">
          <Layers size={20} className="text-dim" />
        </div>
        <p className="text-sm text-muted max-w-xs mb-4">Select or create a workspace to start your research journey</p>
        <button onClick={() => { const name = prompt("Workspace name:"); if (name) createWorkspace(sessionId, name); }}
          className="text-xs px-4 py-2 rounded-md bg-text text-surface hover:opacity-80 transition-opacity"
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
      <WorkspaceHeader workspace={activeWs} sessionId={sessionId}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        mode={mode} setMode={setMode}
        chatOpen={chatOpen} setChatOpen={setChatOpen}
      />

      <div ref={setNodeRef} className={`flex-1 overflow-y-auto ${isOver ? "bg-hover" : ""}`}>
        {(error || stationError) && (
          <div className="px-3 py-2 mx-2 mt-2 text-xs text-text bg-hover rounded-lg">{error || stationError}</div>
        )}

        <div className="animate-fade-in">
          {/* Sources Section - Horizontally Scrollable Masonry with 2 Rows */}
          <div className="mx-3 mb-6">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers size={14} className="text-accent" />
              Sources ({filteredSources.length})
            </h3>
            {loading ? (
              <SkeletonTallCard count={6} />
            ) : searchQuery.trim() && filteredSources.length === 0 ? (
              <EmptyState icon={Search} message="No sources match your search" />
            ) : filteredSources.length > 0 ? (
              <div className="flex overflow-x-auto overflow-y-hidden pb-4 -mx-3 px-3">
                <div className="flex flex-col gap-2 shrink-0">
                  {filteredSources.some((s) => s._type === "page") && (
                    <div className="flex gap-2">
                      {filteredSources.filter((s) => s._type === "page").map((s) => (
                        <SourceCard key={s.id} item={s} type={s._type}
                          isPinned={isPinned(s._type, s.id)}
                          onPin={handlePin} onUnpin={handleUnpin}
                          onDelete={handleDeleteSource}
                          onReader={(url, title) => openReader(url, title, s.media_url)}
                          onSummary={(url, title) => openSummarizer(url, title)}
                        />
                      ))}
                    </div>
                  )}
                  {filteredSources.some((s) => s._type === "image" || s._type === "video") && (
                    <div className="flex gap-2">
                      {filteredSources.filter((s) => s._type === "image" || s._type === "video").map((s) => (
                        <SourceCard key={s.id} item={s} type={s._type}
                          isPinned={isPinned(s._type, s.id)}
                          onPin={handlePin} onUnpin={handleUnpin}
                          onDelete={handleDeleteSource}
                          onReader={(url, title) => openReader(url, title, s.media_url)}
                          onSummary={(url, title) => openSummarizer(url, title)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState icon={Layers} message="Add sources to your workspace from Search Assist" />
            )}
          </div>

          {/* Notes Section */}
          <div className="mx-3 mb-6">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
              <ListChecks size={14} className="text-accent" />
              Notes ({station.notes.length})
            </h3>
            {loading ? (
              <SkeletonTallCard count={4} />
            ) : (
              <NotesSection
                notes={station.notes}
                sessionId={sessionId} wsId={activeId}
                pins={station.pins}
                searchQuery={searchQuery}
                onCreateNote={handleCreateNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
                onPin={handlePin} onUnpin={handleUnpin}
              />
            )}
          </div>

          {/* Comparisons Section */}
          <div className="mx-3 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-dim uppercase tracking-wider flex items-center gap-2">
                <Scale size={14} className="text-accent" /> Comparisons ({station.comparisons.length})
              </h3>
              <button onClick={() => setCompareOpen(!compareOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all active:scale-95 ${
                  compareOpen ? "bg-hover text-text border-text/40" : "border-border text-text hover:bg-hover"
                }`}
              ><Scale size={14} /> Compare</button>
            </div>

            {compareOpen && (
              <ComparePanel sources={allSources} onClose={() => setCompareOpen(false)} onSave={handleSaveComparison} />
            )}

            {station.comparisons.length === 0 ? (
              <EmptyState icon={Scale} message="Pick two sources with Compare to save a comparison here" />
            ) : (
              <SavedComparisons comparisons={station.comparisons} onDelete={handleDeleteComparison} />
            )}
          </div>
        </div>
      </div>
      {chatOpen && (
        <ChatModal workspaceId={activeId} workspaceName={activeWs?.name} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}
