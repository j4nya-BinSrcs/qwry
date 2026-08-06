import {
  Book, Check, ExternalLink, FileText, Image, Layers, Loader2, Maximize2, MessageCircle,
  Pencil, Pin, Plus, Scale, Sparkles, Trash2, Video, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as canvasApi from "../api/canvas";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useWorkspaceStationStore } from "../stores/workspaceStationStore";
import { useUIStore } from "../stores/uiStore";

// ── Helpers ──────────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function centerOf(node) {
  const s = nodeSize(node);
  return {
    x: node.x + s.w / 2,
    y: node.y + s.h / 2,
  };
}

function Favicon({ domain }) {
  return (
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt=""
      className="size-4 rounded-md shrink-0"
      onError={(e) => { e.target.style.display = "none"; }}
    />
  );
}

const NODE_COLORS = {
  source: "#3b82f6",
  note: "#10b981",
  image: "#f59e0b",
  video: "#ef4444",
  comparison: "#8b5cf6",
  ai_response: "#ec4899",
  task: "#14b8a6",
};

const NODE_DIMS = {
  source: { w: 240, h: 210 },
  note: { w: 240, h: 190 },
  image: { w: 220, h: 200 },
  video: { w: 220, h: 190 },
  comparison: { w: 260, h: 150 },
  ai_response: { w: 240, h: 170 },
  task: { w: 220, h: 110 },
};

function nodeSize(node) {
  const d = NODE_DIMS[node.object_type] || {};
  return { w: d.w || node.width || 200, h: d.h || node.height || 120 };
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

function sanitizeZoom(z) {
  return typeof z === "number" && Number.isFinite(z)
    ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
    : 1;
}

function sanitizeViewport(v) {
  return {
    x: Number.isFinite(v.x) ? v.x : 0,
    y: Number.isFinite(v.y) ? v.y : 0,
    zoom: sanitizeZoom(v.zoom),
  };
}

const TYPE_LABELS = {
  source: "Source", note: "Note", image: "Image", video: "Video",
  comparison: "Comparison", ai_response: "AI Response", task: "Task",
};

const GRID_LINE = "color-mix(in srgb, var(--color-border) 55%, transparent)";

function IconBtn({ title, onClick, children, className }) {
  return (
    <button title={title}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      className={`p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors shrink-0 ${className || ""}`}
    >{children}</button>
  );
}

// ── Node Card ─────────────────────────────────────────────────────────────

function NodeCard({ node, obj, isSelected, connectionMode, onSelect, onDragStart, onDelete, onConnect, onOpenReader, onOpenSummarizer, onOpenUrl, isPinned, onTogglePin, onEditNote }) {
  const type = node.object_type;
  const color = node.color || NODE_COLORS[type] || "#666";
  const { w, h } = nodeSize(node);
  const domain = getHostname(obj?.url || "");

  return (
    <div
      className={`canvas-node absolute rounded-lg bg-elevated overflow-hidden transition-all hover:shadow-pop ${
        isSelected ? "ring-2 ring-text" : connectionMode === node.id ? "ring-2 ring-text/60" : "shadow-surface"
      }`}
      style={{ left: node.x, top: node.y, width: w, height: h, zIndex: node.z_index || 0 }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(node.id, e); }}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id, e); }}
    >
      <div className="h-0.5 shrink-0" style={{ backgroundColor: color }} />

      {(type === "image" || type === "video") ? (
        <div className="h-full flex flex-col">
          <div className="relative flex-1 min-h-0 bg-hover overflow-hidden">
            {(type === "video" ? obj?.thumbnail : obj?.url) ? (
              <img src={type === "video" ? obj?.thumbnail : obj?.url} alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {type === "image" ? <Image size={24} className="text-dim opacity-40" /> : <Video size={24} className="text-dim opacity-40" />}
              </div>
            )}
            <div className="absolute top-1 right-1 flex gap-1">
              {onConnect && <IconBtn title="Connect"><Plus size={16} /></IconBtn>}
              <IconBtn title="Remove from canvas" onClick={() => onDelete(node.id)}><Trash2 size={16} /></IconBtn>
            </div>
          </div>
          <div className="shrink-0 px-3 py-2 border-t border-border/50">
            <p className="text-xs text-text truncate">{obj?.title || obj?.caption || node.label || TYPE_LABELS[type] || "Untitled"}</p>
            <div className="flex items-center gap-1 mt-1">
              {obj?.url ? (
                <>
                  <Favicon domain={getHostname(obj.url)} />
                  <span className="text-base text-muted truncate flex-1">{getHostname(obj.url)}</span>
                  <IconBtn title="Open" onClick={() => onOpenUrl(obj.url)}><ExternalLink size={16} /></IconBtn>
                </>
              ) : (
                <span className="text-base text-muted truncate flex-1">{obj?.platform || ""}</span>
              )}
              {type === "video" && obj?.url && (
                <IconBtn title="Summarize" onClick={() => onOpenSummarizer(obj.url, obj.title)}><Sparkles size={16} /></IconBtn>
              )}
              <IconBtn title={isPinned ? "Unpin" : "Pin"} onClick={() => onTogglePin(type, obj?.id || node.object_id)}>
                <Pin size={16} className={isPinned ? "text-text" : ""} />
              </IconBtn>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full flex flex-col px-3 py-2 min-h-0">
          <div className="flex items-center gap-2 mb-1">
            {type === "source" && (domain ? <Favicon domain={domain} /> : <Layers size={16} style={{ color }} />)}
            {type === "note" && <FileText size={16} style={{ color }} />}
            {type === "comparison" && <Scale size={16} style={{ color }} />}
            {type === "ai_response" && <MessageCircle size={16} style={{ color }} />}
            {type === "task" && <Check size={16} style={{ color }} />}
            {type === "source"
              ? <span className="text-base text-muted truncate flex-1">{domain || "Source"}</span>
              : <span className="text-base uppercase tracking-wider text-dim">{TYPE_LABELS[type]}</span>}
            {onConnect && <IconBtn title="Connect"><Plus size={16} /></IconBtn>}
            <IconBtn title="Remove from canvas" onClick={() => onDelete(node.id)}><Trash2 size={16} /></IconBtn>
          </div>
          <p className="text-xs font-medium text-text truncate">{obj?.title || node.label || "Untitled"}</p>
          {type === "source" && obj?.snippet && <p className="text-base text-muted mt-1 line-clamp-3 leading-relaxed">{obj.snippet}</p>}
          {type === "note" && obj?.content && <p className="text-base text-muted mt-1 line-clamp-5 leading-relaxed whitespace-pre-line">{obj.content}</p>}
          {type === "comparison" && obj?.data?.sources?.length === 2 && (
            <p className="text-base text-muted mt-1 truncate">{(obj.data.sources[0].title || "A")} vs {(obj.data.sources[1].title || "B")}</p>
          )}
          {type === "ai_response" && obj?.response_text && <p className="text-base text-muted mt-1 line-clamp-4 leading-relaxed">{obj.response_text}</p>}
          {type === "task" && obj?.name && <p className="text-base text-muted mt-1 truncate">{obj.name}</p>}
          {type === "source" && (
            <div className="flex items-center gap-1 mt-auto pt-2">
              <IconBtn title="Reader" onClick={() => obj?.url && onOpenReader(obj.url, obj.title)}><Book size={16} /></IconBtn>
              <IconBtn title="Summarize" onClick={() => obj?.url && onOpenSummarizer(obj.url, obj.title)}><Sparkles size={16} /></IconBtn>
              <IconBtn title="Open" onClick={() => obj?.url && onOpenUrl(obj.url)}><ExternalLink size={16} /></IconBtn>
              <div className="flex-1" />
              <IconBtn title={isPinned ? "Unpin" : "Pin"} onClick={() => onTogglePin("source", obj?.id || node.object_id)}>
                <Pin size={16} className={isPinned ? "text-text" : ""} />
              </IconBtn>
            </div>
          )}
          {type === "note" && (
            <div className="flex items-center gap-1 mt-auto pt-2">
              <IconBtn title="Edit note" onClick={() => onEditNote(node)}><Pencil size={16} /></IconBtn>
              <div className="flex-1" />
              <IconBtn title={isPinned ? "Unpin" : "Pin"} onClick={() => onTogglePin("note", obj?.id || node.object_id)}>
                <Pin size={16} className={isPinned ? "text-text" : ""} />
              </IconBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Connection Lines (SVG) ───────────────────────────────────────────────

function ConnectionLines({ connections, nodes, onDelete }) {
  if (connections.length === 0) return null;
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
      {connections.map((conn) => {
        const src = nodes[conn.source_node_id];
        const tgt = nodes[conn.target_node_id];
        if (!src || !tgt) return null;
        const s = centerOf(src);
        const t = centerOf(tgt);
        const dash = conn.style === "dashed" ? "6,3" : conn.style === "dotted" ? "2,3" : undefined;
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        return (
          <g key={conn.id}>
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="transparent" strokeWidth={10}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => onDelete && onDelete(conn.id)}
            />
            <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={conn.color || "#666"} strokeWidth={2}
              strokeDasharray={dash}
              className="transition-all"
            />
            {conn.label && (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill="var(--color-muted)" style={{ pointerEvents: "none" }}>
                {conn.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Minimap ───────────────────────────────────────────────────────────────

function Minimap({ nodes, viewport }) {
  const nodesArr = Object.values(nodes);
  if (nodesArr.length === 0) return null;
  const MINIMAP_SIZE = 120;
  const PAD = 10;

  const xs = nodesArr.map((n) => n.x);
  const ys = nodesArr.map((n) => n.y);
  const minX = Math.min(...xs) - 50;
  const minY = Math.min(...ys) - 50;
  const maxX = Math.max(...xs.map((x, i) => x + nodeSize(nodesArr[i]).w)) + 50;
  const maxY = Math.max(...ys.map((y, i) => y + nodeSize(nodesArr[i]).h)) + 50;
  const areaW = maxX - minX || 400;
  const areaH = maxY - minY || 400;
  const scale = Math.min((MINIMAP_SIZE - PAD * 2) / areaW, (MINIMAP_SIZE - PAD * 2) / areaH);

  return (
    <div className="canvas-ui absolute bottom-2 right-2 size-[120px] rounded-md border border-border bg-surface/80 backdrop-blur-sm overflow-hidden shadow-md z-10">
      <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE}>
        {nodesArr.map((n) => {
          const s = nodeSize(n);
          const cx = PAD + (n.x + s.w / 2 - minX) * scale;
          const cy = PAD + (n.y + s.h / 2 - minY) * scale;
          return <circle key={n.id} cx={cx} cy={cy} r={2} fill="var(--color-dim)" />;
        })}
        <rect
          x={PAD + (-viewport.x / viewport.zoom - minX) * scale}
          y={PAD + (-viewport.y / viewport.zoom - minY) * scale}
          width={(window.innerWidth || 800) / viewport.zoom * scale}
          height={(window.innerHeight || 600) / viewport.zoom * scale}
          fill="none" stroke="var(--color-muted)" strokeWidth={1} rx={2}
        />
      </svg>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────

function Legend({ counts }) {
  const entries = Object.keys(NODE_COLORS).filter((t) => counts[t] > 0);
  if (entries.length === 0) return null;
  return (
    <div className="canvas-ui absolute bottom-2 left-2 z-10 rounded-md border border-border bg-surface/80 backdrop-blur-sm px-2 py-2 shadow-md">
      {entries.map((t) => (
        <div key={t} className="flex items-center gap-2 py-1">
          <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[t] }} />
          <span className="text-base text-muted capitalize">{TYPE_LABELS[t]}</span>
          <span className="text-base text-dim ml-1">{counts[t]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Inspector Panel ───────────────────────────────────────────────────────

function InspectorBtn({ onClick, children, primary }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 text-base px-2 py-1 rounded-md transition-colors ${
        primary ? "bg-text text-surface hover:opacity-80" : "border border-border text-text hover:bg-hover"
      }`}
    >{children}</button>
  );
}

function InspectorPanel({ node, obj, isPinned, onTogglePin, onDeleteNode, onDeleteObject, onOpenReader, onOpenSummarizer, onOpenUrl, onUpdateNote, onClose }) {
  const type = node.object_type;
  const color = node.color || NODE_COLORS[type] || "#666";
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft({ title: obj?.title || node.label || "", content: obj?.content || "" });
    setSaved(false);
  }, [node.id]);

  if (!node) return null;

  const data = obj?.data;

  const renderBody = () => {
    switch (type) {
      case "source":
        return (
          <div className="space-y-2">
            {obj?.url && (
              <div className="flex items-center gap-2">
                <Favicon domain={getHostname(obj.url)} />
                <span className="text-base text-muted truncate flex-1">{getHostname(obj.url)}</span>
              </div>
            )}
            <p className="text-xs font-medium text-text">{obj?.title || node.label || "Untitled"}</p>
            {obj?.snippet && <p className="text-xs text-muted leading-relaxed">{obj.snippet}</p>}
            {obj?.summary && (
              <div>
                <div className="flex items-center gap-1 text-base text-dim uppercase tracking-wide font-medium mb-1">
                  <Sparkles size={16} /> Summary
                </div>
                <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{obj.summary}</p>
              </div>
            )}
            {obj?.notes && (
              <div>
                <div className="text-base text-dim uppercase tracking-wide font-medium mb-1">Notes</div>
                <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{obj.notes}</p>
              </div>
            )}
            <div className="flex items-center gap-1 pt-1">
              {obj?.url && <InspectorBtn primary onClick={() => onOpenReader(obj.url, obj.title)}><Book size={16} /> Reader</InspectorBtn>}
              {obj?.url && <InspectorBtn onClick={() => onOpenSummarizer(obj.url, obj.title)}><Sparkles size={16} /> Summarize</InspectorBtn>}
              {obj?.url && <InspectorBtn onClick={() => onOpenUrl(obj.url)}><ExternalLink size={16} /> Open</InspectorBtn>}
              <InspectorBtn onClick={() => onTogglePin("source", obj?.id || node.object_id)}><Pin size={16} /> {isPinned ? "Unpin" : "Pin"}</InspectorBtn>
            </div>
          </div>
        );
      case "note":
        return (
          <div className="space-y-2">
            <input type="text" value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title" maxLength={500}
              className="w-full bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim"
            />
            <textarea value={draft.content} rows={5}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder="Content..."
              className="w-full bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim resize-none"
            />
            <div className="flex items-center gap-1">
              <InspectorBtn primary onClick={async () => { await onUpdateNote(draft); setSaved(true); }}>
                <Check size={16} /> Save
              </InspectorBtn>
              {saved && <span className="text-base text-dim">Saved</span>}
              <div className="flex-1" />
              <InspectorBtn onClick={() => onTogglePin("note", obj?.id || node.object_id)}><Pin size={16} /> {isPinned ? "Unpin" : "Pin"}</InspectorBtn>
            </div>
          </div>
        );
      case "image":
      case "video":
        return (
          <div className="space-y-2">
            {(type === "video" ? obj?.thumbnail : obj?.url) && (
              <img src={type === "video" ? obj?.thumbnail : obj?.url} alt=""
                className="w-full h-24 object-cover rounded-md"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <p className="text-xs font-medium text-text">{obj?.title || obj?.caption || node.label || "Untitled"}</p>
            {obj?.platform && <p className="text-base text-muted">{obj.platform}</p>}
            <div className="flex items-center gap-1 pt-1">
              {obj?.url && <InspectorBtn primary onClick={() => onOpenUrl(obj.url)}><ExternalLink size={16} /> Open</InspectorBtn>}
              {type === "video" && obj?.url && <InspectorBtn onClick={() => onOpenSummarizer(obj.url, obj.title)}><Sparkles size={16} /> Summarize</InspectorBtn>}
              <InspectorBtn onClick={() => onTogglePin(type, obj?.id || node.object_id)}><Pin size={16} /> {isPinned ? "Unpin" : "Pin"}</InspectorBtn>
            </div>
          </div>
        );
      case "comparison":
        return (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text">{node.label || obj?.title || "Comparison"}</p>
            {data?.type === "two-way" && data.sources?.length === 2 ? (
              <div className="grid grid-cols-2 gap-2">
                {data.sources.map((s, i) => (
                  <div key={i} className="space-y-1 min-w-0">
                    <p className="text-base font-medium text-text truncate">{s.title || "Untitled"}</p>
                    <p className="text-base text-dim">{s.url ? getHostname(s.url) : s._type}</p>
                    {s.snippet && <p className="text-base text-muted leading-relaxed line-clamp-3">{s.snippet}</p>}
                    {s.summary && <p className="text-base text-text leading-relaxed line-clamp-3">{s.summary}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{JSON.stringify(data ?? {})}</p>
            )}
          </div>
        );
      case "ai_response":
        return <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{obj?.response_text || node.label || "No content"}</p>;
      case "task":
        return <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{obj?.description || node.label || "No content"}</p>;
      default:
        return <p className="text-xs text-muted">{node.label || "No content"}</p>;
    }
  };

  return (
    <div className="canvas-ui absolute top-2 right-2 z-20 w-64 max-h-[75%] overflow-y-auto rounded-lg border border-border bg-elevated/95 backdrop-blur-sm shadow-pop flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-elevated/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-base font-semibold text-text">{TYPE_LABELS[type] || "Node"}</span>
        </div>
        <IconBtn title="Close" onClick={onClose}><X size={16} /></IconBtn>
      </div>
      <div className="p-3">
        {renderBody()}
      </div>
      <div className="shrink-0 px-3 py-2 border-t border-border flex items-center gap-2 sticky bottom-0 bg-elevated/95 backdrop-blur-sm">
        <InspectorBtn onClick={() => onDeleteNode(node.id)}><Trash2 size={16} /> Remove</InspectorBtn>
        <div className="flex-1" />
        {onDeleteObject && (
          <InspectorBtn onClick={onDeleteObject}><Trash2 size={16} /> Delete {TYPE_LABELS[type] || "Object"}</InspectorBtn>
        )}
      </div>
    </div>
  );
}

// ── Compare Dialog ────────────────────────────────────────────────────────

function snapshotSource(s) {
  return {
    _type: s._type, id: s.id, title: s.title, url: s.url, snippet: s.snippet,
    summary: s.summary, notes: s.notes, caption: s.caption, thumbnail: s.thumbnail,
  };
}

function CompareDialog({ sources, onClose, onCreate }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const srcA = sources.find((s) => s.id === a);
  const srcB = sources.find((s) => s.id === b);

  const handleCreate = () => {
    if (!srcA || !srcB || srcA.id === srcB.id) return;
    const title = `${srcA.title || "Untitled"} vs ${srcB.title || "Untitled"}`;
    const data = { type: "two-way", sources: [snapshotSource(srcA), snapshotSource(srcB)] };
    onCreate(title, data);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-text/20" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-80 max-w-[90%] rounded-lg bg-elevated border border-border shadow-pop p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text">Compare Sources</h3>
          <IconBtn title="Close" onClick={onClose}><X size={16} /></IconBtn>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <select value={a} onChange={(e) => setA(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">Source A...</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
          </select>
          <span className="text-base text-dim shrink-0">vs</span>
          <select value={b} onChange={(e) => setB(e.target.value)}
            className="flex-1 min-w-0 truncate bg-hover border border-border rounded-md px-2 py-1 text-xs text-text outline-none"
          >
            <option value="">Source B...</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.title || s.id?.slice(0, 12)}</option>)}
          </select>
        </div>
        <button onClick={handleCreate} disabled={!srcA || !srcB || srcA.id === srcB.id}
          className="w-full flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-md bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30"
        ><Scale size={16} /> Create Comparison</button>
      </div>
    </div>
  );
}

// ── Main Canvas View ─────────────────────────────────────────────────────

export default function CanvasView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useWorkspaceStore((s) => s.items);
  const notes = useWorkspaceStationStore((s) => s.notes);
  const images = useWorkspaceStationStore((s) => s.images);
  const videos = useWorkspaceStationStore((s) => s.videos);
  const comparisons = useWorkspaceStationStore((s) => s.comparisons);
  const pins = useWorkspaceStationStore((s) => s.pins);
  const createNote = useWorkspaceStationStore((s) => s.createNote);
  const updateNote = useWorkspaceStationStore((s) => s.updateNote);
  const deleteNote = useWorkspaceStationStore((s) => s.deleteNote);
  const createPin = useWorkspaceStationStore((s) => s.createPin);
  const deletePin = useWorkspaceStationStore((s) => s.deletePin);
  const createComparison = useWorkspaceStationStore((s) => s.createComparison);
  const deleteComparison = useWorkspaceStationStore((s) => s.deleteComparison);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);

  const [nodes, setNodes] = useState({});
  const [connections, setConnections] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [connectionMode, setConnectionMode] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [noteComposer, setNoteComposer] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const containerRef = useRef(null);
  const draggingRef = useRef(null);
  const panningRef = useRef(null);
  const zoomRef = useRef(1);

  useEffect(() => { zoomRef.current = viewport.zoom; }, [viewport.zoom]);

  // ── Load canvas data + auto-populate from station ─────────────────

  useEffect(() => {
    if (!activeId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [nodeList, connList] = await Promise.all([
          canvasApi.listNodes(sessionId, activeId),
          canvasApi.listConnections(sessionId, activeId),
        ]);
        if (cancelled) return;

        const nodeMap = {};
        for (const n of nodeList) nodeMap[n.id] = n;

        // Load station data (best-effort)
        const wsStore = useWorkspaceStore.getState();
        const stationStore = useWorkspaceStationStore.getState();
        try {
          await Promise.all([
            wsStore.loadItems(sessionId, activeId),
            stationStore.loadAll(sessionId, activeId),
          ]);
        } catch { /* station load is best-effort */ }
        if (cancelled) return;

        // Auto-populate only when the canvas is brand new (so deleted nodes stay deleted)
        if (nodeList.length === 0) {
          const wsItems = useWorkspaceStore.getState().items;
          const st = useWorkspaceStationStore.getState();
          const stationItems = [
            ...wsItems.map((i) => ({ type: "source", id: i.id, label: i.title })),
            ...st.notes.map((n) => ({ type: "note", id: n.id, label: n.title })),
            ...st.images.map((img) => ({ type: "image", id: img.id, label: img.caption })),
            ...st.videos.map((v) => ({ type: "video", id: v.id, label: v.title })),
            ...st.comparisons.map((c) => ({ type: "comparison", id: c.id, label: c.title })),
          ];
          if (stationItems.length > 0) {
            const gridCols = Math.ceil(Math.sqrt(stationItems.length));
            const created = await Promise.all(
              stationItems.map((si, i) => {
                const dims = NODE_DIMS[si.type] || { w: 200, h: 80 };
                const col = i % gridCols;
                const row = Math.floor(i / gridCols);
                return canvasApi.createNode(sessionId, activeId, {
                  object_type: si.type,
                  object_id: si.id,
                  x: col * 280 + 40,
                  y: row * 260 + 40,
                  width: dims.w,
                  height: dims.h,
                  label: si.label || "",
                });
              })
            );
            for (const cn of created) if (cn) nodeMap[cn.id] = cn;
          }
        }

        if (cancelled) return;
        setNodes(nodeMap);
        setSelectedIds(new Set());
        setConnections(connList);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [activeId, sessionId]);

  // ── Lookups ───────────────────────────────────────────────────────

  const objectMap = useMemo(() => {
    const m = {};
    for (const i of items) m[`source:${i.id}`] = i;
    for (const n of notes) m[`note:${n.id}`] = n;
    for (const im of images) m[`image:${im.id}`] = im;
    for (const v of videos) m[`video:${v.id}`] = v;
    for (const c of comparisons) m[`comparison:${c.id}`] = c;
    return m;
  }, [items, notes, images, videos, comparisons]);

  const allSources = useMemo(() => [
    ...items.map((i) => ({ ...i, _type: "page" })),
    ...images.map((img) => ({ ...img, _type: "image" })),
    ...videos.map((v) => ({ ...v, _type: "video" })),
  ], [items, images, videos]);

  const unplaced = useMemo(() => {
    const placed = new Set(Object.values(nodes).map((n) => `${n.object_type}:${n.object_id}`));
    const list = [];
    for (const i of items) list.push({ key: `source:${i.id}`, type: "source", label: i.title || getHostname(i.url) || "Untitled", id: i.id });
    for (const n of notes) list.push({ key: `note:${n.id}`, type: "note", label: n.title || "Untitled", id: n.id });
    for (const im of images) list.push({ key: `image:${im.id}`, type: "image", label: im.caption || "Image", id: im.id });
    for (const v of videos) list.push({ key: `video:${v.id}`, type: "video", label: v.title || "Video", id: v.id });
    for (const c of comparisons) list.push({ key: `comparison:${c.id}`, type: "comparison", label: c.title || "Comparison", id: c.id });
    return list.filter((x) => !placed.has(x.key));
  }, [nodes, items, notes, images, videos, comparisons]);

  const isPinned = useCallback((type, id) => {
    const t = type === "source" ? "item" : type;
    return pins.some((p) => p.pinnable_type === t && p.pinnable_id === id);
  }, [pins]);

  const togglePin = useCallback(async (type, id) => {
    if (!activeId) return;
    const t = type === "source" ? "item" : type;
    const existing = pins.find((p) => p.pinnable_type === t && p.pinnable_id === id);
    if (existing) await deletePin(sessionId, activeId, existing.id);
    else await createPin(sessionId, activeId, t, id);
  }, [activeId, sessionId, pins, deletePin, createPin]);

  // ── Node CRUD ─────────────────────────────────────────────────────

  const addNode = useCallback(async (objectType, objectId, label, x, y) => {
    if (!activeId) return null;
    const dims = NODE_DIMS[objectType] || { w: 200, h: 80 };
    const node = await canvasApi.createNode(sessionId, activeId, {
      object_type: objectType, object_id: objectId || crypto.randomUUID(),
      x: x ?? Math.random() * 300, y: y ?? Math.random() * 300,
      width: dims.w, height: dims.h, label: label || "",
    });
    if (node) setNodes((prev) => ({ ...prev, [node.id]: node }));
    return node;
  }, [sessionId, activeId]);

  const updateNode = useCallback(async (nodeId, data) => {
    if (!activeId) return;
    setNodes((prev) => prev[nodeId] ? { ...prev, [nodeId]: { ...prev[nodeId], ...data } } : prev);
    try {
      const updated = await canvasApi.updateNode(sessionId, activeId, nodeId, data);
      setNodes((prev) => prev[nodeId] ? { ...prev, [nodeId]: updated } : prev);
    } catch {
      setNodes((prev) => prev[nodeId] ? { ...prev, [nodeId]: { ...prev[nodeId], ...data } } : prev);
    }
  }, [sessionId, activeId]);

  const deleteNode = useCallback(async (nodeId) => {
    if (!activeId) return;
    try {
      await canvasApi.deleteNode(sessionId, activeId, nodeId);
      setNodes((prev) => { const { [nodeId]: _, ...rest } = prev; return rest; });
      setConnections((prev) => prev.filter((c) => c.source_node_id !== nodeId && c.target_node_id !== nodeId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(nodeId); return next; });
    } catch {}
  }, [activeId, sessionId]);

  // ── Connections ───────────────────────────────────────────────────

  const addConnection = useCallback(async (sourceId, targetId) => {
    if (!activeId || sourceId === targetId) return;
    try {
      const conn = await canvasApi.createConnection(sessionId, activeId, {
        source_node_id: sourceId, target_node_id: targetId,
      });
      if (conn) setConnections((prev) => [...prev, conn]);
    } catch {}
  }, [activeId, sessionId]);

  const deleteConnection = useCallback(async (connId) => {
    if (!activeId) return;
    try {
      await canvasApi.deleteConnection(sessionId, activeId, connId);
      setConnections((prev) => prev.filter((c) => c.id !== connId));
    } catch {}
  }, [activeId, sessionId]);

  // ── Station ↔ canvas sync ─────────────────────────────────────────

  const handleCreateNote = useCallback(async (title, content, x, y) => {
    const note = await createNote(sessionId, activeId, title, content);
    if (note) await addNode("note", note.id, note.title, x, y);
    return note;
  }, [createNote, sessionId, activeId, addNode]);

  const handleUpdateNote = useCallback(async (noteId, draft) => {
    const updated = await updateNote(sessionId, activeId, noteId, draft);
    if (updated) {
      const node = Object.values(nodes).find((n) => n.object_type === "note" && n.object_id === noteId);
      if (node) updateNode(node.id, { label: updated.title });
    }
    return updated;
  }, [updateNote, sessionId, activeId, nodes, updateNode]);

  const handleDeleteNote = useCallback(async (noteId) => {
    await deleteNote(sessionId, activeId, noteId);
    const node = Object.values(nodes).find((n) => n.object_type === "note" && n.object_id === noteId);
    if (node) deleteNode(node.id);
  }, [deleteNote, sessionId, activeId, nodes, deleteNode]);

  const handleCreateComparison = useCallback(async (title, data) => {
    const comp = await createComparison(sessionId, activeId, title, data);
    if (comp) {
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? (rect.width / 2 - viewport.x) / viewport.zoom - 130 : 200;
      const y = rect ? (rect.height / 2 - viewport.y) / viewport.zoom - 60 : 200;
      await addNode("comparison", comp.id, comp.title, x, y);
    }
    setCompareOpen(false);
    return comp;
  }, [createComparison, sessionId, activeId, addNode, viewport]);

  const handleDeleteComparison = useCallback(async (compId) => {
    await deleteComparison(sessionId, activeId, compId);
    const node = Object.values(nodes).find((n) => n.object_type === "comparison" && n.object_id === compId);
    if (node) deleteNode(node.id);
  }, [deleteComparison, sessionId, activeId, nodes, deleteNode]);

  const placeNode = useCallback(async (u) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = rect ? (rect.width / 2 - viewport.x) / viewport.zoom - 120 + Math.random() * 40 : 200;
    const y = rect ? (rect.height / 2 - viewport.y) / viewport.zoom - 60 + Math.random() * 40 : 200;
    await addNode(u.type, u.id, u.label, x, y);
    setAddMenu(false);
  }, [addNode, viewport]);

  // ── Pan ───────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    if (e.target && e.target.closest && e.target.closest(".canvas-ui")) return;
    if (e.button === 0 && e.target !== e.currentTarget && !e.target.closest(".canvas-bg")) return;
    if (e.button === 2) e.preventDefault();
    setSelectedIds(new Set());
    panningRef.current = { lastX: e.clientX, lastY: e.clientY };
  }, []);

  // ── Zoom + pan (native, non-passive wheel listener) ──────────────

  useEffect(() => {
    if (loading || !activeId) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.target && e.target.closest && e.target.closest(".canvas-ui")) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Math.max(rect.height, 1) : 1;
      const dx = Number.isFinite(e.deltaX) ? e.deltaX * unit : 0;
      const dy = Number.isFinite(e.deltaY) ? e.deltaY * unit : 0;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const isPinch = e.ctrlKey || e.metaKey;
      if (isPinch || Math.max(Math.abs(dx), Math.abs(dy)) >= 15) {
        const factor = Math.exp(-(dy || dx) * (isPinch ? 0.1 : 0.002));
        setViewport((v) => {
          const s = sanitizeViewport(v);
          const newZoom = sanitizeZoom(s.zoom * factor);
          const scale = newZoom / (s.zoom || 1);
          return { x: mx - scale * (mx - s.x), y: my - scale * (my - s.y), zoom: newZoom };
        });
      } else {
        setViewport((v) => sanitizeViewport({ ...v, x: v.x - dx, y: v.y - dy }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [loading, activeId]);

  // ── Window mouse events (drag/pan) ───────────────────────────────

  useEffect(() => {
    const handleMove = (e) => {
      if (panningRef.current) {
        const dx = e.clientX - panningRef.current.lastX;
        const dy = e.clientY - panningRef.current.lastY;
        panningRef.current.lastX = e.clientX;
        panningRef.current.lastY = e.clientY;
        setViewport((v) => sanitizeViewport({ ...v, x: v.x + dx, y: v.y + dy }));
      }
      if (draggingRef.current) {
        const d = draggingRef.current;
        const zoom = Number.isFinite(zoomRef.current) ? zoomRef.current : 1;
        const nx = Number.isFinite(d.origX + (e.clientX - d.startX) / zoom) ? d.origX + (e.clientX - d.startX) / zoom : d.origX;
        const ny = Number.isFinite(d.origY + (e.clientY - d.startY) / zoom) ? d.origY + (e.clientY - d.startY) / zoom : d.origY;
        draggingRef.current.lastX = nx;
        draggingRef.current.lastY = ny;
        setNodes((prev) => prev[d.id] ? {
          ...prev,
          [d.id]: { ...prev[d.id], x: nx, y: ny },
        } : prev);
      }
    };
    const handleUp = () => {
      if (panningRef.current) panningRef.current = null;
      if (draggingRef.current) {
        const d = draggingRef.current;
        if (Number.isFinite(d.lastX) && Number.isFinite(d.lastY)) {
          updateNode(d.id, { x: d.lastX, y: d.lastY });
        }
        draggingRef.current = null;
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [updateNode]);

  // ── Node drag ─────────────────────────────────────────────────────

  const handleNodeDragStart = useCallback((nodeId, e) => {
    e.stopPropagation();
    const node = nodes[nodeId];
    if (!node) return;
    draggingRef.current = {
      id: nodeId, startX: e.clientX, startY: e.clientY,
      origX: node.x, origY: node.y, lastX: node.x, lastY: node.y,
    };
  }, [nodes]);

  // ── Select ────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((nodeId, e) => {
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    } else {
      setSelectedIds(new Set([nodeId]));
    }
  }, []);

  // ── Connection mode ───────────────────────────────────────────────

  const handleConnect = useCallback((nodeId) => {
    if (connectionMode === null) {
      setConnectionMode(nodeId);
    } else if (connectionMode === nodeId) {
      setConnectionMode(null);
    } else {
      addConnection(connectionMode, nodeId);
      setConnectionMode(null);
    }
  }, [connectionMode, addConnection]);

  // ── Keyboard shortcuts ────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (e.key === "Escape") {
        setConnectionMode(null);
        setSelectedIds(new Set());
        setAddMenu(false);
        setCompareOpen(false);
        setNoteComposer(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          for (const id of selectedIds) deleteNode(id);
          setSelectedIds(new Set());
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, deleteNode]);

  // ── Double-click background → create note ─────────────────────────

  const handleDoubleClick = useCallback((e) => {
    if (e.target !== e.currentTarget && !e.target.closest(".canvas-bg")) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setNoteComposer({ px: e.clientX - rect.left, py: e.clientY - rect.top });
    setNoteTitle("");
    setNoteContent("");
  }, []);

  const createNoteAt = useCallback(async () => {
    if (!noteTitle.trim() || !noteComposer) return;
    const x = (noteComposer.px - viewport.x) / viewport.zoom;
    const y = (noteComposer.py - viewport.y) / viewport.zoom;
    await handleCreateNote(noteTitle.trim(), noteContent, x, y);
    setNoteComposer(null);
    setNoteTitle("");
    setNoteContent("");
  }, [noteTitle, noteContent, noteComposer, viewport, handleCreateNote]);

  // ── Fit to screen ─────────────────────────────────────────────────

  const fitToScreen = useCallback(() => {
    const values = Object.values(nodes);
    if (values.length === 0) { setViewport({ x: 0, y: 0, zoom: 1 }); return; }
    const xs = values.map((n) => n.x);
    const ys = values.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs.map((x, i) => x + nodeSize(values[i]).w));
    const maxY = Math.max(...ys.map((y, i) => y + nodeSize(values[i]).h));
    const areaW = maxX - minX + 100;
    const areaH = maxY - minY + 100;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = sanitizeZoom(Math.min(rect.width / areaW, rect.height / areaH, 1.5));
    setViewport(sanitizeViewport({
      x: (rect.width - areaW * zoom) / 2 - minX * zoom,
      y: (rect.height - areaH * zoom) / 2 - minY * zoom,
      zoom,
    }));
  }, [nodes]);

  // ── Derived render state ──────────────────────────────────────────

  const counts = useMemo(() => {
    const c = {};
    for (const n of Object.values(nodes)) c[n.object_type] = (c[n.object_type] || 0) + 1;
    return c;
  }, [nodes]);

  const selectedNode = selectedIds.size === 1 ? nodes[[...selectedIds][0]] : null;
  const selectedObj = selectedNode ? objectMap[`${selectedNode.object_type}:${selectedNode.object_id}`] : null;

  // ── Render ────────────────────────────────────────────────────────

  if (!activeId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
            <Layers size={16} className="text-text" />
          </div>
          <p className="text-sm text-muted">Create or select a workspace to use Canvas</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading canvas...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <p className="text-xs text-text bg-hover rounded-md px-3 py-2">{error}</p>
        </div>
      </div>
    );
  }

  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
  const gridSize = 24 * viewport.zoom;
  const zoomPct = Number.isFinite(viewport.zoom) ? Math.round(viewport.zoom * 100) : 100;

  return (
    <div className="h-full flex">
      {/* Canvas area */}
      <div className="flex-1 min-w-0 relative overflow-hidden bg-surface"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Grid background */}
        <div className="absolute inset-0 canvas-bg"
          style={{
            backgroundImage: `linear-gradient(to right, ${GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            transform: `translate(${viewport.x % gridSize}px, ${viewport.y % gridSize}px)`,
          }}
        />

        {/* Connection SVG */}
        <div style={{ transform, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
          <ConnectionLines connections={connections} nodes={nodes} onDelete={deleteConnection} />
        </div>

        {/* Nodes */}
        <div style={{ transform, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
          {Object.values(nodes).map((node) => (
            <NodeCard key={node.id} node={node}
              obj={objectMap[`${node.object_type}:${node.object_id}`]}
              isSelected={selectedIds.has(node.id)}
              connectionMode={connectionMode}
              onSelect={handleNodeClick}
              onDragStart={handleNodeDragStart}
              onDelete={deleteNode}
              onConnect={handleConnect}
              onOpenReader={openReader}
              onOpenSummarizer={openSummarizer}
              onOpenUrl={(url) => window.open(url, "_blank")}
              isPinned={isPinned(node.object_type, node.object_id)}
              onTogglePin={togglePin}
              onEditNote={(n) => setSelectedIds(new Set([n.id]))}
            />
          ))}
        </div>

        {/* Empty state overlay */}
        {Object.keys(nodes).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="size-8 rounded-lg bg-elevated flex items-center justify-center mx-auto mb-3">
                <Layers size={16} className="text-dim" />
              </div>
              <p className="text-xs text-muted max-w-xs mb-3">Canvas is empty — double-click anywhere to add a note, use the Add menu, or add sources from Search Assist</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => { const r = containerRef.current?.getBoundingClientRect(); setNoteComposer(r ? { px: r.width / 2 - 80, py: r.height / 2 - 60 } : { px: 200, py: 200 }); }}
                  className="pointer-events-auto text-xs px-3 py-2 rounded-md border border-border text-text hover:bg-hover transition-colors"
                >+ New Note</button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <Legend counts={counts} />

        {/* Minimap */}
        <Minimap nodes={nodes} viewport={viewport} />

        {/* Inspector */}
        {selectedNode && (
          <InspectorPanel
            node={selectedNode}
            obj={selectedObj}
            isPinned={selectedObj ? isPinned(selectedNode.object_type, selectedObj.id) : false}
            onTogglePin={togglePin}
            onDeleteNode={deleteNode}
            onDeleteObject={selectedNode.object_type === "note"
              ? () => handleDeleteNote(selectedNode.object_id)
              : selectedNode.object_type === "comparison"
                ? () => handleDeleteComparison(selectedNode.object_id)
                : null}
            onOpenReader={openReader}
            onOpenSummarizer={openSummarizer}
            onOpenUrl={(url) => window.open(url, "_blank")}
            onUpdateNote={(draft) => handleUpdateNote(selectedNode.object_id, draft)}
            onClose={() => setSelectedIds(new Set())}
          />
        )}

        {/* Note composer */}
        {noteComposer && (
          <div className="canvas-ui absolute z-30 w-56 rounded-lg border border-border bg-elevated shadow-pop p-2"
            style={{ left: noteComposer.px, top: noteComposer.py }}
          >
            <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title..." maxLength={120} autoFocus
              className="w-full bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim mb-2"
              onKeyDown={(e) => { if (e.key === "Enter") createNoteAt(); if (e.key === "Escape") setNoteComposer(null); }}
            />
            <input type="text" value={noteContent} onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Content (optional)" maxLength={500}
              className="w-full bg-hover border border-border rounded-md px-2 py-2 text-xs text-text outline-none placeholder:text-dim mb-2"
            />
            <div className="flex items-center gap-1">
              <button onClick={createNoteAt} disabled={!noteTitle.trim()}
                className="flex items-center gap-1 text-base px-2 py-1 rounded-md bg-text text-surface hover:opacity-80 transition-opacity disabled:opacity-30"
              ><Plus size={16} /> Add</button>
              <button onClick={() => setNoteComposer(null)}
                className="text-base px-2 py-1 rounded-md border border-border text-dim hover:text-text transition-colors"
              >Cancel</button>
            </div>
          </div>
        )}

        {/* Compare dialog */}
        {compareOpen && (
          <CompareDialog sources={allSources}
            onClose={() => setCompareOpen(false)}
            onCreate={handleCreateComparison}
          />
        )}

        {/* Toolbar */}
        <div className="canvas-ui absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 rounded-lg bg-surface/90 backdrop-blur-sm border border-border shadow-md z-10">
          <button onClick={() => { const r = containerRef.current?.getBoundingClientRect(); setNoteComposer(r ? { px: r.width / 2 - 80, py: r.height / 2 - 60 } : { px: 200, py: 200 }); setNoteTitle(""); setNoteContent(""); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-base text-text hover:bg-hover transition-colors" title="Create a note on the canvas"
          ><FileText size={16} /> Note</button>
          <button onClick={() => setCompareOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-base text-text hover:bg-hover transition-colors" title="Compare two sources"
          ><Scale size={16} /> Compare</button>
          <div className="relative">
            <button onClick={() => setAddMenu(!addMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-base text-text hover:bg-hover transition-colors" title="Add a station item to the canvas"
            ><Plus size={16} /> Add{unplaced.length > 0 ? ` (${unplaced.length})` : ""}</button>
            {addMenu && (
              <div className="absolute bottom-full left-0 mb-1 w-64 max-h-64 overflow-y-auto rounded-lg bg-elevated border border-border shadow-pop z-20">
                <div className="px-3 py-2 text-base text-muted font-medium border-b border-border">Add from station</div>
                {unplaced.length === 0 && (
                  <div className="px-3 py-3 text-base text-dim text-center">All station items are already on the canvas</div>
                )}
                {unplaced.map((u) => (
                  <button key={u.key} onClick={() => placeNode(u)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-text hover:bg-hover transition-colors"
                  >
                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: NODE_COLORS[u.type] || "#666" }} />
                    <span className="truncate">{u.label}</span>
                    <span className="text-base text-dim shrink-0 capitalize">{u.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={() => setViewport((v) => sanitizeViewport({ ...v, zoom: v.zoom - 0.2 }))}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Zoom out"
          ><ZoomOut size={16} /></button>
          <span className="text-base text-dim w-10 text-center font-mono">{zoomPct}%</span>
          <button onClick={() => setViewport((v) => sanitizeViewport({ ...v, zoom: v.zoom + 0.2 }))}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Zoom in"
          ><ZoomIn size={16} /></button>
          <button onClick={fitToScreen}
            className="p-1 rounded-md text-dim hover:text-text hover:bg-hover transition-colors" title="Fit to screen"
          ><Maximize2 size={16} /></button>
        </div>
      </div>
    </div>
  );
}
