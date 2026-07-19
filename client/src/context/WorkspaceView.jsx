import {
  Book, Check, ChevronDown, ChevronRight, ExternalLink, GripVertical, Image, Loader2, MessageCircle,
  Pencil, Pin, Plus, Search, Sparkles, Tag, Trash2, Video, X, ListOrdered, Clock, FileText, Layers,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import { useUIStore } from "../stores/uiStore";
import ChatModal from "../components/ChatModal";

const SECTIONS = [
  { id: "sources", label: "Sources", icon: Layers },
  { id: "summaries", label: "Summaries", icon: Sparkles },
  { id: "reading", label: "Reading Q", icon: Book },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "ai-tools", label: "AI Tools", icon: MessageCircle },
  { id: "pins", label: "Pins", icon: Pin },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
  { id: "comparisons", label: "Comparisons", icon: ListOrdered },
  { id: "search", label: "Search", icon: Search },
];

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

function EmptyState({ icon: Icon, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {Icon && <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mb-3">
        <Icon size={16} className="text-dim" />
      </div>}
      <p className="text-xs text-muted max-w-xs">{message}</p>
      {action}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="size-4 border-2 border-text border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Source Item Card (sortable) ──────────────────────────────────────────

function SourceItemCard({ item }) {
  const sessionId = useSessionStore((s) => s.sessionId);
  const deleteItem = useWorkspaceStore((s) => s.deleteItem);
  const summarizeItem = useWorkspaceStore((s) => s.summarizeItem);
  const summarizingId = useWorkspaceStore((s) => s.summarizingId);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const [expanded, setExpanded] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "workspace-item", item },
  });

  const isSummarizing = summarizingId === item.id;
  const hasSummary = !!item.summary;

  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }}
      onClick={() => setExpanded(!expanded)}
      className="group bg-panel border border-border rounded-md transition-all hover:border-text/40 cursor-pointer"
    >
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button {...attributes} {...listeners}
          className="mt-0.5 shrink-0 text-dim cursor-grab active:cursor-grabbing hover:text-text transition-colors"
        ><GripVertical size={14} /></button>
        <Favicon domain={getHostname(item.url)} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">{item.title || "Untitled"}</div>
          <div className="text-xs text-muted mt-0.5 truncate">{getHostname(item.url)}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); openReader(item.url, item.title, item.media_url); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Reader"
          ><Book size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); summarizeItem(sessionId, item.id); }} disabled={isSummarizing}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
            title={hasSummary ? "Re-summarize" : "Summarize"}
          >{isSummarizing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}</button>
          <button onClick={(e) => { e.stopPropagation(); window.open(item.url, "_blank"); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
          ><ExternalLink size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); deleteItem(sessionId, item.id); }}
            className="p-1.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
          ><Trash2 size={13} /></button>
        </div>
      </div>
      {expanded && (item.snippet || item.notes || hasSummary || isSummarizing) && (
        <div className="px-3 pb-2.5 border-t border-border space-y-1.5">
          {item.snippet && <p className="text-xs text-muted mt-1.5 leading-relaxed">{item.snippet}</p>}
          {item.notes && <p className="text-xs text-dim leading-relaxed italic">{item.notes}</p>}
          {isSummarizing && (
            <div className="flex items-center gap-1.5 text-xs text-muted mt-1.5">
              <Loader2 size={11} className="animate-spin" /> Generating summary...
            </div>
          )}
          {hasSummary && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-text">
                <Sparkles size={11} /> <span className="font-medium">Summary</span>
                <span className="text-dim font-normal">via {item.summary_model || item.summary_provider || "ollama"}</span>
              </div>
              <p className="text-xs text-text leading-relaxed whitespace-pre-line">{item.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Workspace Header ─────────────────────────────────────────────────────

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
          <div className="relative">
            <button onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center gap-2 text-sm font-semibold text-text hover:text-muted transition-colors"
            >
              <span className="truncate max-w-28">{workspace?.name || "Workspace"}</span>
              <span className="text-xs text-dim">{workspace?.item_count ?? 0}</span>
            </button>
            {showWsMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 rounded bg-elevated border border-border shadow-xl overflow-hidden z-10">
                <div className="px-3 py-1.5 text-[10px] text-muted font-medium border-b border-border">Workspaces</div>
                {workspaces.map((ws) => (
                  <button key={ws.id}
                    onClick={() => { setActive(ws.id); setShowWsMenu(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                      ws.id === activeId ? "bg-hover text-text" : "text-text hover:bg-hover"
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
                >+ New Workspace</button>
              </div>
            )}
          </div>
          {workspace && (
            <button onClick={startEdit}
              className="p-0.5 rounded text-dim opacity-0 group-hover/title:opacity-100 hover:text-text transition-all"
            ><Pencil size={11} /></button>
          )}
        </div>
        {editing && (
          <div className="flex items-center gap-1 mt-1">
            <input type="text" value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(e); if (e.key === "Escape") setEditing(false); }}
              autoFocus
              className="flex-1 bg-hover border border-border rounded px-2 py-0.5 text-xs text-text outline-none"
            />
            <button onClick={saveEdit} className="p-0.5 rounded text-dim hover:text-text"><Check size={12} /></button>
            <button onClick={() => setEditing(false)} className="p-0.5 rounded text-dim hover:text-text"><X size={12} /></button>
          </div>
        )}
      </div>
      <button onClick={onChatClick}
        className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
      ><MessageCircle size={12} /> Chat</button>
    </div>
  );
}

// ── Section Components ───────────────────────────────────────────────────

function SourcesSection({ items, loading, sessionId, className }) {
  const { setNodeRef, isOver } = useDroppable({ id: "workspace-drop", data: { type: "workspace" } });
  return (
    <div className={className}>
      {loading && items.length === 0 && <Spinner />}
      {!loading && items.length === 0 && <EmptyState icon={Layers} message="Drag search results here to save them for later" />}
      {!loading && items.length > 0 && (
        <div ref={setNodeRef}
          className={`flex-1 overflow-y-auto p-2 transition-all ${isOver ? "bg-hover border-2 border-dashed border-text/30" : ""}`}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="space-y-1">
              {items.map((item) => <SourceItemCard key={item.id} item={item} />)}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function SummariesSection({ items, className }) {
  const hasSummaries = items.filter((i) => i.summary);
  return (
    <div className={className}>
      {hasSummaries.length === 0 && <EmptyState icon={Sparkles} message="No items with summaries yet" />}
      {hasSummaries.length > 0 && (
        <div className="space-y-1 p-2">
          {hasSummaries.map((item) => (
            <div key={item.id} className="bg-panel border border-border rounded-md px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Favicon domain={getHostname(item.url)} />
                <span className="text-sm font-medium text-text truncate">{item.title || "Untitled"}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text">
                <Sparkles size={11} /> <span className="font-medium">Summary</span>
                <span className="text-dim">via {item.summary_model || item.summary_provider || "ollama"}</span>
              </div>
              <p className="text-xs text-text leading-relaxed whitespace-pre-line mt-1">{item.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReadingQueueSection({ reads, sessionId, wsId, className }) {
  const updateReadStatus = useWorkspaceStationStore((s) => s.updateReadStatus);
  const deleteRead = useWorkspaceStationStore((s) => s.deleteRead);
  const openReader = useUIStore((s) => s.openReader);
  return (
    <div className={className}>
      {reads.length === 0 && <EmptyState icon={Book} message="No items in reading queue" />}
      {reads.length > 0 && (
        <div className="space-y-1 p-2">
          {reads.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-panel border border-border rounded-md px-3 py-2">
              <div className={`size-2 rounded-full shrink-0 ${
                r.status === "completed" ? "bg-text" : r.status === "reading" ? "bg-text" : "bg-border"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate font-medium">{r.item_id}</div>
                <div className="text-[10px] text-muted mt-0.5 capitalize">{r.status}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.status !== "reading" && (
                  <button onClick={() => updateReadStatus(sessionId, wsId, r.id, "reading")}
                    className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Mark reading"
                  ><Book size={12} /></button>
                )}
                {r.status !== "completed" && (
                  <button onClick={() => updateReadStatus(sessionId, wsId, r.id, "completed")}
                    className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Mark completed"
                  ><Check size={12} /></button>
                )}
                <button onClick={() => deleteRead(sessionId, wsId, r.id)}
                  className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all" title="Remove"
                ><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesSection({ notes, sessionId, wsId, className }) {
  const createNote = useWorkspaceStationStore((s) => s.createNote);
  const updateNote = useWorkspaceStationStore((s) => s.updateNote);
  const deleteNote = useWorkspaceStationStore((s) => s.deleteNote);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleAdd = async () => {
    if (!title.trim()) return;
    await createNote(sessionId, wsId, title.trim(), content);
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
    await updateNote(sessionId, wsId, noteId, { title: editTitle.trim(), content: editContent });
    setEditingId(null);
  };

  return (
    <div className={className}>
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-3 py-2 border-b border-border space-y-2">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..." maxLength={500}
            className="w-full bg-hover border border-border rounded px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim"
          />
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Note content..." rows={3}
            className="w-full bg-hover border border-border rounded px-2 py-1.5 text-xs text-text outline-none placeholder:text-dim resize-none"
          />
          <button onClick={handleAdd} disabled={!title.trim()}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30"
          ><Plus size={12} /> Add Note</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {notes.length === 0 && <EmptyState icon={FileText} message="No notes yet" />}
          {notes.map((n) => (
            <div key={n.id} className="bg-panel border border-border rounded-md px-3 py-2">
              {editingId === n.id ? (
                <div className="space-y-2">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
                  />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3}
                    className="w-full bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none resize-none"
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
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text truncate">{n.title}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(n)}
                        className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
                      ><Pencil size={11} /></button>
                      <button onClick={() => deleteNote(sessionId, wsId, n.id)}
                        className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
                      ><Trash2 size={11} /></button>
                    </div>
                  </div>
                  {n.content && <p className="text-xs text-text leading-relaxed mt-1 whitespace-pre-line">{n.content}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIToolsSection({ sessionId, wsId, activeWs, tags, items, className }) {
  const [chatOpen, setChatOpen] = useState(false);
  const summarizeItem = useWorkspaceStore((s) => s.summarizeItem);
  const assignTag = useWorkspaceStationStore((s) => s.assignTag);
  const [tagId, setTagId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  return (
    <div className={className}>
      <div className="p-3 space-y-3">
        <div className="bg-panel border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-text mb-2">Chat</h3>
          <p className="text-xs text-muted mb-2">Ask questions about your workspace sources</p>
          <button onClick={() => setChatOpen(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-text text-surface hover:opacity-80 transition-opacity"
          ><MessageCircle size={12} /> Open Chat</button>
          {chatOpen && <ChatModal workspaceId={wsId} workspaceName={activeWs?.name} onClose={() => setChatOpen(false)} />}
        </div>

        <div className="bg-panel border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-text mb-2">Quick Summarize</h3>
          <p className="text-xs text-muted mb-2">Generate summaries for all sources without one</p>
          <button onClick={() => items.filter((i) => !i.summary).forEach((i) => summarizeItem(sessionId, i.id))}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border text-text hover:bg-hover transition-colors"
          ><Sparkles size={12} /> Summarize All</button>
        </div>

        <div className="bg-panel border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-text mb-2">Tag Assignment</h3>
          <div className="flex items-center gap-2">
            <select value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="flex-1 bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
            >
              <option value="">Select an item...</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.title || i.url}</option>)}
            </select>
          </div>
          {selectedItemId && (
            <div className="flex items-center gap-2 mt-2">
              <select value={tagId} onChange={(e) => setTagId(e.target.value)}
                className="flex-1 bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
              >
                <option value="">Select a tag...</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={async () => {
                  if (tagId && selectedItemId) {
                    await assignTag(sessionId, wsId, tagId, "item", selectedItemId);
                    setTagId("");
                  }
                }}
                className="text-xs px-2 py-1 rounded bg-text text-surface hover:opacity-80 transition-opacity"
              >Assign</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PinsSection({ pins, sessionId, wsId, className }) {
  const deletePin = useWorkspaceStationStore((s) => s.deletePin);
  return (
    <div className={className}>
      {pins.length === 0 && <EmptyState icon={Pin} message="No pinned items" />}
      {pins.length > 0 && (
        <div className="space-y-1 p-2">
          {pins.map((p) => (
            <div key={p.id} className="flex items-center gap-3 bg-panel border border-border rounded-md px-3 py-2">
              <Pin size={12} className="text-dim shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text truncate">
                  <span className="font-medium capitalize">{p.pinnable_type}</span>
                  <span className="text-dim"> — {p.pinnable_id}</span>
                </div>
                <div className="text-[10px] text-muted">Order {p.order_index}</div>
              </div>
              <button onClick={() => deletePin(sessionId, wsId, p.id)}
                className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
              ><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineSection({ events, className }) {
  return (
    <div className={className}>
      {events.length === 0 && <EmptyState icon={Clock} message="No timeline events yet" />}
      {events.length > 0 && (
        <div className="space-y-1 p-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 bg-panel border border-border rounded-md px-3 py-2">
              <div className="size-2 rounded-full bg-text mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text capitalize">{e.action_type}</span>
                  <span className="text-xs text-dim capitalize">{e.object_type}</span>
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  {new Date(e.created_at).toLocaleString()}
                </div>
                {e.event_metadata && (
                  <pre className="text-[10px] text-muted mt-1 bg-hover rounded p-1 overflow-x-auto">
                    {JSON.stringify(e.event_metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagsSection({ tags, sessionId, wsId, items, className }) {
  const createTag = useWorkspaceStationStore((s) => s.createTag);
  const deleteTag = useWorkspaceStationStore((s) => s.deleteTag);
  const assignTag = useWorkspaceStationStore((s) => s.assignTag);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#000000");
  const [assignTagId, setAssignTagId] = useState("");
  const [assignItemId, setAssignItemId] = useState("");

  return (
    <div className={className}>
      <div className="p-2 space-y-2">
        <div className="bg-panel border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-text mb-2">Create Tag</h3>
          <div className="flex items-center gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Tag name..." maxLength={100}
              className="flex-1 bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none placeholder:text-dim"
            />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              className="size-6 rounded border border-border cursor-pointer"
            />
            <button onClick={async () => {
                if (name.trim()) {
                  await createTag(sessionId, wsId, name.trim(), color === "#000000" ? null : color);
                  setName("");
                  setColor("#000000");
                }
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-text text-surface hover:opacity-80 transition-opacity"
            ><Plus size={12} /> Add</button>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-md p-3">
          <h3 className="text-xs font-semibold text-text mb-2">Assign Tag</h3>
          <div className="flex items-center gap-2">
            <select value={assignItemId} onChange={(e) => setAssignItemId(e.target.value)}
              className="flex-1 bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
            >
              <option value="">Select an item...</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.title || i.url}</option>)}
            </select>
            <select value={assignTagId} onChange={(e) => setAssignTagId(e.target.value)}
              className="flex-1 bg-hover border border-border rounded px-2 py-1 text-xs text-text outline-none"
            >
              <option value="">Select a tag...</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={async () => {
                if (assignTagId && assignItemId) {
                  await assignTag(sessionId, wsId, assignTagId, "item", assignItemId);
                  setAssignTagId("");
                }
              }}
              className="text-xs px-2 py-1 rounded bg-text text-surface hover:opacity-80 transition-opacity"
            >Assign</button>
          </div>
        </div>

        <div className="space-y-1">
          {tags.length === 0 && <EmptyState icon={Tag} message="No tags created yet" />}
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-2 bg-panel border border-border rounded-md px-3 py-2">
              <div className="size-3 rounded" style={{ backgroundColor: t.color || "#e5e5e5" }} />
              <span className="flex-1 text-xs text-text">{t.name}</span>
              <button onClick={() => deleteTag(sessionId, wsId, t.id)}
                className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
              ><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImagesSection({ images, sessionId, wsId, className }) {
  const deleteImage = useWorkspaceStationStore((s) => s.deleteImage);
  return (
    <div className={className}>
      {images.length === 0 && <EmptyState icon={Image} message="No images saved" />}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 p-2">
          {images.map((img) => (
            <div key={img.id} className="group relative bg-panel border border-border rounded-md overflow-hidden">
              <img src={img.url} alt={img.caption || ""}
                className="w-full h-24 object-cover"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <div className="p-1.5">
                {img.caption && <p className="text-[10px] text-text truncate">{img.caption}</p>}
                <div className="flex items-center gap-1 mt-1">
                  {img.resolution_w && <span className="text-[10px] text-dim">{img.resolution_w}×{img.resolution_h}</span>}
                  <button onClick={() => deleteImage(sessionId, wsId, img.id)}
                    className="ml-auto p-0.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
                  ><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideosSection({ videos, sessionId, wsId, className }) {
  const deleteVideo = useWorkspaceStationStore((s) => s.deleteVideo);
  return (
    <div className={className}>
      {videos.length === 0 && <EmptyState icon={Video} message="No videos saved" />}
      {videos.length > 0 && (
        <div className="space-y-1 p-2">
          {videos.map((v) => (
            <div key={v.id} className="flex items-start gap-3 bg-panel border border-border rounded-md px-3 py-2">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt="" className="size-16 rounded object-cover shrink-0"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              ) : <Video size={24} className="text-dim shrink-0 mt-2" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text font-medium truncate">{v.title || "Untitled"}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {v.platform && <span className="text-[10px] px-1.5 py-0.5 rounded bg-hover text-dim">{v.platform}</span>}
                  {v.duration_secs && <span className="text-[10px] text-dim">{Math.floor(v.duration_secs / 60)}:{(v.duration_secs % 60).toString().padStart(2, "0")}</span>}
                  {v.creator && <span className="text-[10px] text-dim">{v.creator}</span>}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={() => window.open(v.url, "_blank")}
                    className="text-[10px] p-0.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
                  ><ExternalLink size={10} /></button>
                  <button onClick={() => deleteVideo(sessionId, wsId, v.id)}
                    className="text-[10px] p-0.5 rounded text-dim hover:text-text hover:bg-hover transition-all"
                  ><Trash2 size={10} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonsSection({ comparisons, sessionId, wsId, className }) {
  const deleteComparison = useWorkspaceStationStore((s) => s.deleteComparison);
  const [expandedId, setExpandedId] = useState(null);
  return (
    <div className={className}>
      {comparisons.length === 0 && <EmptyState icon={ListOrdered} message="No comparisons yet" />}
      {comparisons.length > 0 && (
        <div className="space-y-1 p-2">
          {comparisons.map((c) => (
            <div key={c.id} className="bg-panel border border-border rounded-md px-3 py-2">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                <div className="flex items-center gap-2">
                  {expandedId === c.id ? <ChevronDown size={12} className="text-dim" /> : <ChevronRight size={12} className="text-dim" />}
                  <span className="text-sm font-medium text-text">{c.title}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteComparison(sessionId, wsId, c.id); }}
                  className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-all"
                ><Trash2 size={12} /></button>
              </div>
              {expandedId === c.id && c.data && (
                <pre className="text-[10px] text-muted mt-2 bg-hover rounded p-2 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(c.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSection({ sessionId, wsId, className }) {
  const searchWorkspace = useWorkspaceStationStore((s) => s.searchWorkspace);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await searchWorkspace(sessionId, wsId, query.trim());
      setResults(res || []);
      setSearched(true);
    }, 300);
  }, [query, sessionId, wsId, searchWorkspace]);

  return (
    <div className={className}>
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspace..."
              className="w-full h-8 pl-8 pr-3 rounded bg-hover border border-border text-xs text-text outline-none placeholder:text-dim"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!searched && !query && <EmptyState icon={Search} message="Type to search across all workspace content" />}
          {searched && results.length === 0 && <EmptyState icon={Search} message="No results found" />}
          {results.length > 0 && results.map((r, i) => (
            <div key={`${r.object_id}-${i}`} className="bg-panel border border-border rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-dim uppercase">{r.object_type}</span>
                <span className="text-xs text-text truncate">{r.title}</span>
              </div>
              {r.snippet && <p className="text-xs text-muted mt-0.5">{r.snippet}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Station View ───────────────────────────────────────────────────

export default function WorkspaceView() {
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
  const [activeSection, setActiveSection] = useState("sources");

  useEffect(() => {
    if (activeId) {
      loadItems(sessionId, activeId);
      station.loadAll(sessionId, activeId);
    }
  }, [activeId, sessionId]);

  const activeWs = workspaces.find((w) => w.id === activeId);

  if (!activeWs) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mb-3">
          <Layers size={16} className="text-dim" />
        </div>
        <p className="text-xs text-muted max-w-xs mb-3">
          Select or create a workspace to get started
        </p>
        <button onClick={() => { const name = prompt("Workspace name:"); if (name) createWorkspace(sessionId, name); }}
          className="text-xs px-3 py-1.5 rounded bg-text text-surface hover:opacity-80 transition-opacity"
        >Create Workspace</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader workspace={activeWs} sessionId={sessionId} onChatClick={() => setActiveSection("ai-tools")} />

      {/* Section pills */}
      <div className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-border">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
              activeSection === s.id
                ? "bg-hover text-text font-medium"
                : "text-muted hover:text-text hover:bg-hover"
            }`}
          ><s.icon size={12} /> {s.label}</button>
        ))}
      </div>

      {/* Content area — all sections rendered unconditionally, hidden via className */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {(error || stationError) && <div className="px-3 py-2 m-2 text-xs text-text bg-hover rounded">{error || stationError}</div>}

        <SourcesSection items={items} loading={loading} sessionId={sessionId}
          className={activeSection === "sources" ? "" : "hidden"} />
        <SummariesSection items={items}
          className={activeSection === "summaries" ? "" : "hidden"} />
        <ReadingQueueSection reads={station.reads} sessionId={sessionId} wsId={activeId}
          className={activeSection === "reading" ? "" : "hidden"} />
        <NotesSection notes={station.notes} sessionId={sessionId} wsId={activeId}
          className={activeSection === "notes" ? "" : "hidden"} />
        <AIToolsSection sessionId={sessionId} wsId={activeId} activeWs={activeWs} tags={station.tags} items={items}
          className={activeSection === "ai-tools" ? "" : "hidden"} />
        <PinsSection pins={station.pins} sessionId={sessionId} wsId={activeId}
          className={activeSection === "pins" ? "" : "hidden"} />
        <TimelineSection events={station.timeline}
          className={activeSection === "timeline" ? "" : "hidden"} />
        <TagsSection tags={station.tags} sessionId={sessionId} wsId={activeId} items={items}
          className={activeSection === "tags" ? "" : "hidden"} />
        <ImagesSection images={station.images} sessionId={sessionId} wsId={activeId}
          className={activeSection === "images" ? "" : "hidden"} />
        <VideosSection videos={station.videos} sessionId={sessionId} wsId={activeId}
          className={activeSection === "videos" ? "" : "hidden"} />
        <ComparisonsSection comparisons={station.comparisons} sessionId={sessionId} wsId={activeId}
          className={activeSection === "comparisons" ? "" : "hidden"} />
        <SearchSection sessionId={sessionId} wsId={activeId}
          className={activeSection === "search" ? "" : "hidden"} />
      </div>
    </div>
  );
}
