import { Check, FileText, Image, Layers, Loader2, MessageCircle, Minus, Plus, Search, Tag, Trash2, Video, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as canvasApi from "../api/canvas";
import * as stationApi from "../api/workspaceStation";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";

// ── Helpers ──────────────────────────────────────────────────────────────

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function centerOf(node) {
  return {
    x: node.x + (node.width || 200) / 2,
    y: node.y + (node.height || 80) / 2,
  };
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
  source: { w: 220, h: 80 },
  note: { w: 220, h: 100 },
  image: { w: 200, h: 160 },
  video: { w: 220, h: 90 },
  comparison: { w: 220, h: 70 },
  ai_response: { w: 240, h: 100 },
  task: { w: 220, h: 70 },
};

// ── Node Card ─────────────────────────────────────────────────────────────

function NodeCard({ node, onClick, onDragStart, onDelete, onConnect, isSelected, connectionMode }) {
  const color = NODE_COLORS[node.object_type] || "#666";

  const content = () => {
    switch (node.object_type) {
      case "source":
        return (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Layers size={14} style={{ color }} className="shrink-0" />
              <span className="text-xs font-medium text-text truncate">{node.label || node.object_id?.slice(0, 8)}</span>
            </div>
            {node.object_id && <span className="text-[10px] text-dim truncate mt-0.5 block">{node.object_id?.slice(0, 16)}</span>}
          </>
        );
      case "note":
        return (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={14} style={{ color }} className="shrink-0" />
              <span className="text-xs font-medium text-text truncate">{node.label || "Note"}</span>
            </div>
          </>
        );
      case "image":
        return (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Image size={14} style={{ color }} className="shrink-0" />
              <span className="text-xs font-medium text-text truncate">{node.label || "Image"}</span>
            </div>
          </>
        );
      case "video":
        return (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <Video size={14} style={{ color }} className="shrink-0" />
              <span className="text-xs font-medium text-text truncate">{node.label || "Video"}</span>
            </div>
          </>
        );
      case "comparison":
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Search size={14} style={{ color }} className="shrink-0" />
            <span className="text-xs font-medium text-text truncate">{node.label || "Comparison"}</span>
          </div>
        );
      case "ai_response":
        return (
          <div className="flex items-center gap-2 min-w-0">
            <MessageCircle size={14} style={{ color }} className="shrink-0" />
            <span className="text-xs font-medium text-text truncate">{node.label || "AI Response"}</span>
          </div>
        );
      case "task":
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Check size={14} style={{ color }} className="shrink-0" />
            <span className="text-xs font-medium text-text truncate">{node.label || "Task"}</span>
          </div>
        );
      default:
        return <span className="text-xs text-text">{node.label || "Unknown"}</span>;
    }
  };

  return (
    <div
      className={`absolute rounded-lg border-2 bg-panel shadow-md cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg overflow-hidden ${
        isSelected ? "ring-2 ring-text" : connectionMode === node.id ? "ring-2 ring-text/60" : ""
      }`}
      style={{
        left: node.x, top: node.y, width: node.width || 200,
        zIndex: node.z_index || 0,
      }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(node.id, e); }}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
    >
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="px-3 py-2 space-y-1">
        {content()}
      </div>
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
        {onConnect && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onConnect(node.id); }}
            className="p-0.5 rounded text-dim hover:text-text hover:bg-hover transition-colors"
            title="Connect"
          >
            <Plus size={10} />
          </button>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          className="p-0.5 rounded text-dim hover:text-text hover:bg-hover transition-colors"
          title="Remove"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ── Connection Lines (SVG) ───────────────────────────────────────────────

function ConnectionLines({ connections, nodes }) {
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
        return (
          <line
            key={conn.id}
            x1={s.x} y1={s.y} x2={t.x} y2={t.y}
            stroke={conn.color || "#666"}
            strokeWidth={2}
            strokeDasharray={dash}
            className="transition-all"
          />
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
  const maxX = Math.max(...xs.map((x) => x + (nodesArr.find((n) => n.x === x)?.width || 200))) + 50;
  const maxY = Math.max(...ys.map((y) => y + (nodesArr.find((n) => n.y === y)?.height || 80))) + 50;
  const areaW = maxX - minX || 400;
  const areaH = maxY - minY || 400;
  const scale = Math.min((MINIMAP_SIZE - PAD * 2) / areaW, (MINIMAP_SIZE - PAD * 2) / areaH);

  return (
    <div className="absolute bottom-2 right-2 size-[120px] rounded border border-border bg-surface/80 backdrop-blur-sm overflow-hidden shadow-md z-10">
      <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE}>
        {nodesArr.map((n) => {
          const cx = PAD + (n.x + (n.width || 200) / 2 - minX) * scale;
          const cy = PAD + (n.y + (n.height || 80) / 2 - minY) * scale;
          return <circle key={n.id} cx={cx} cy={cy} r={2} fill="#888" />;
        })}
        <rect
          x={PAD + (-viewport.x / viewport.zoom - minX) * scale}
          y={PAD + (-viewport.y / viewport.zoom - minY) * scale}
          width={(window.innerWidth || 800) / viewport.zoom * scale}
          height={(window.innerHeight || 600) / viewport.zoom * scale}
          fill="none" stroke="#666" strokeWidth={1} rx={2}
        />
      </svg>
    </div>
  );
}

// ── Import Panel ──────────────────────────────────────────────────────────

const IMPORT_TABS = [
  { id: "sources", label: "Sources", icon: Layers },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "images", label: "Images", icon: Image },
  { id: "videos", label: "Videos", icon: Video },
];

function ImportPanel({ wsId, sessionId, onPlace }) {
  const [tab, setTab] = useState("sources");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      let data = [];
      try {
        if (tab === "sources") data = await stationApi.listReads(sessionId, wsId);
        else if (tab === "notes") data = await (await fetch(`/api/workspaces/${wsId}/station/notes`, { headers: { "X-Session-Id": sessionId } })).json();
        else if (tab === "images") data = await stationApi.listImages ? await stationApi.listImages(sessionId, wsId) : [];
        else if (tab === "videos") data = await stationApi.listVideos ? await stationApi.listVideos(sessionId, wsId) : [];
      } catch {}
      if (!cancelled) { setItems(data || []); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [tab, wsId, sessionId]);

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      <div className="shrink-0 px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold text-text">Import to Canvas</h3>
      </div>
      <div className="shrink-0 flex gap-1 px-2 py-1.5 border-b border-border">
        {IMPORT_TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
              tab === t.id ? "bg-hover text-text font-medium" : "text-dim hover:text-text hover:bg-hover"
            }`}
          ><t.icon size={10} /> {t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-dim" /></div>}
        {!loading && items.length === 0 && <p className="text-[10px] text-dim text-center py-4">Nothing to import</p>}
        {items.map((item) => (
          <button key={item.id}
            onClick={() => onPlace(tab === "sources" ? "source" : tab === "notes" ? "note" : tab === "images" ? "image" : "video", item)}
            className="w-full text-left px-2 py-1.5 rounded text-[10px] text-text hover:bg-hover transition-colors truncate"
          >{item.title || item.id?.slice(0, 12)}</button>
        ))}
      </div>
    </div>
  );
}

// ── Main Canvas View ─────────────────────────────────────────────────────

export default function CanvasView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [nodes, setNodes] = useState({});
  const [connections, setConnections] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [connectionMode, setConnectionMode] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [noteInput, setNoteInput] = useState("");

  const containerRef = useRef(null);
  const draggingRef = useRef(null);
  const panningRef = useRef(null);
  const zoomRef = useRef(1);

  useEffect(() => { zoomRef.current = viewport.zoom; }, [viewport.zoom]);

  // ── Load canvas data ──────────────────────────────────────────────

  useEffect(() => {
    if (!activeId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      canvasApi.listNodes(sessionId, activeId),
      canvasApi.listConnections(sessionId, activeId),
    ]).then(([nodeList, connList]) => {
      if (cancelled) return;
      const m = {};
      for (const n of nodeList) m[n.id] = n;
      setNodes(m);
      setConnections(connList);
      setLoading(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err.message);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeId, sessionId]);

  // ── Node CRUD ─────────────────────────────────────────────────────

  const addNode = useCallback(async (objectType, objectId, label, x, y) => {
    if (!activeId) return;
    const dims = NODE_DIMS[objectType] || { w: 200, h: 80 };
    const node = await canvasApi.createNode(sessionId, activeId, {
      object_type: objectType, object_id: objectId || crypto.randomUUID(),
      x: x ?? Math.random() * 300, y: y ?? Math.random() * 300,
      width: dims.w, height: dims.h, label: label || "",
    });
    if (node) setNodes((prev) => ({ ...prev, [node.id]: node }));
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
    } catch {}
  }, [sessionId, activeId]);

  // ── Connections ───────────────────────────────────────────────────

  const addConnection = useCallback(async (sourceId, targetId) => {
    if (!activeId || sourceId === targetId) return;
    try {
      const conn = await canvasApi.createConnection(sessionId, activeId, {
        source_node_id: sourceId, target_node_id: targetId,
      });
      if (conn) setConnections((prev) => [...prev, conn]);
    } catch {}
  }, [sessionId, activeId]);

  const deleteConnection = useCallback(async (connId) => {
    if (!activeId) return;
    try {
      await canvasApi.deleteConnection(sessionId, activeId, connId);
      setConnections((prev) => prev.filter((c) => c.id !== connId));
    } catch {}
  }, [sessionId, activeId]);

  // ── Pan ───────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget && !e.target.closest(".canvas-bg")) return;
    setSelectedIds(new Set());
    panningRef.current = { startX: e.clientX, startY: e.clientY, origX: viewport.x, origY: viewport.y };
  }, [viewport]);

  // ── Zoom ──────────────────────────────────────────────────────────

  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * (1 + delta)));
    const scale = newZoom / viewport.zoom;
    setViewport((v) => ({
      x: mx - scale * (mx - v.x),
      y: my - scale * (my - v.y),
      zoom: newZoom,
    }));
  }, [viewport]);

  // ── Window mouse events (drag/pan) ───────────────────────────────

  useEffect(() => {
    const handleMove = (e) => {
      if (panningRef.current) {
        const dx = e.clientX - panningRef.current.startX;
        const dy = e.clientY - panningRef.current.startY;
        setViewport((v) => ({ ...v, x: panningRef.current.origX + dx, y: panningRef.current.origY + dy }));
      }
      if (draggingRef.current) {
        const d = draggingRef.current;
        const dx = (e.clientX - d.startX) / zoomRef.current;
        const dy = (e.clientY - d.startY) / zoomRef.current;
        draggingRef.current.lastX = d.origX + dx;
        draggingRef.current.lastY = d.origY + dy;
        setNodes((prev) => prev[d.id] ? {
          ...prev,
          [d.id]: { ...prev[d.id], x: d.origX + dx, y: d.origY + dy },
        } : prev);
      }
    };
    const handleUp = () => {
      if (panningRef.current) panningRef.current = null;
      if (draggingRef.current) {
        const d = draggingRef.current;
        updateNode(d.id, { x: d.lastX, y: d.lastY });
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

  const handleNodeClick = useCallback((nodeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
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

  // ── Import onto canvas ────────────────────────────────────────────

  const handlePlace = useCallback((objectType, item) => {
    addNode(objectType, item.id, item.title || item.name, Math.random() * 400, Math.random() * 300);
  }, [addNode]);

  // ── Create inline note ────────────────────────────────────────────

  const handleCreateNote = useCallback(() => {
    const title = noteInput.trim() || "New Note";
    addNode("note", null, title, Math.random() * 400, Math.random() * 300);
    setNoteInput("");
  }, [noteInput, addNode]);

  // ── Fit to screen ─────────────────────────────────────────────────

  const fitToScreen = useCallback(() => {
    const values = Object.values(nodes);
    if (values.length === 0) { setViewport({ x: 0, y: 0, zoom: 1 }); return; }
    const xs = values.map((n) => n.x);
    const ys = values.map((n) => n.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs.map((x, i) => x + (values[i].width || 200)));
    const maxY = Math.max(...ys.map((y, i) => y + (values[i].height || 80)));
    const areaW = maxX - minX + 100;
    const areaH = maxY - minY + 100;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = Math.min(rect.width / areaW, rect.height / areaH, 1.5);
    setViewport({
      x: (rect.width - areaW * zoom) / 2 - minX * zoom,
      y: (rect.height - areaH * zoom) / 2 - minY * zoom,
      zoom,
    });
  }, [nodes]);

  // ── Render ────────────────────────────────────────────────────────

  if (!activeId) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-8">
          <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mx-auto mb-3">
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
          <p className="text-xs text-text bg-hover rounded px-3 py-2">{error}</p>
        </div>
      </div>
    );
  }

  const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

  return (
    <div className="h-full flex">
      {/* Canvas area */}
      <div className="flex-1 min-w-0 relative overflow-hidden bg-surface"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Grid background */}
        <div className="absolute inset-0 canvas-bg"
          style={{
            backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
            transform: `translate(${viewport.x % (20 * viewport.zoom)}px, ${viewport.y % (20 * viewport.zoom)}px)`,
          }}
        />

        {/* Connection SVG */}
        <div style={{ transform, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
          <ConnectionLines connections={connections} nodes={nodes} />
        </div>

        {/* Nodes */}
        <div style={{ transform, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
          {Object.values(nodes).map((node) => (
            <NodeCard key={node.id} node={node}
              isSelected={selectedIds.has(node.id)}
              connectionMode={connectionMode}
              onClick={handleNodeClick}
              onDragStart={handleNodeDragStart}
              onDelete={deleteNode}
              onConnect={handleConnect}
            />
          ))}
        </div>

        {/* Empty state overlay */}
        {Object.keys(nodes).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center pointer-events-auto">
              <div className="size-8 rounded bg-hover border border-border flex items-center justify-center mx-auto mb-3">
                <Layers size={16} className="text-dim" />
              </div>
              <p className="text-xs text-muted max-w-xs mb-3">Canvas is empty — import content from your workspace or create a note</p>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setShowImport(!showImport)}
                  className="pointer-events-auto text-xs px-3 py-1.5 rounded bg-text text-surface hover:opacity-80 transition-opacity"
                >Import Content</button>
                <button onClick={() => { const name = prompt("Note title:"); if (name) addNode("note", null, name, 100, 100); }}
                  className="pointer-events-auto text-xs px-3 py-1.5 rounded border border-border text-text hover:bg-hover transition-colors"
                >+ New Note</button>
              </div>
            </div>
          </div>
        )}

        {/* Minimap */}
        <Minimap nodes={nodes} viewport={viewport} />

        {/* Toolbar */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface/90 backdrop-blur-sm border border-border shadow-md z-10">
          <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.max(0.1, v.zoom - 0.2) }))}
            className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors" title="Zoom out"
          ><ZoomOut size={14} /></button>
          <span className="text-[10px] text-dim w-10 text-center font-mono">{Math.round(viewport.zoom * 100)}%</span>
          <button onClick={() => setViewport((v) => ({ ...v, zoom: Math.min(5, v.zoom + 0.2) }))}
            className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors" title="Zoom in"
          ><ZoomIn size={14} /></button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={fitToScreen}
            className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors" title="Fit to screen"
          ><Minus size={14} /></button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={() => setShowImport(!showImport)}
            className={`p-1 rounded transition-colors ${showImport ? "bg-hover text-text" : "text-dim hover:text-text hover:bg-hover"}`}
            title="Import content"
          ><Layers size={14} /></button>
          <div className="flex items-center gap-1 ml-1">
            <input type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Note..." maxLength={100}
              className="w-20 bg-hover border border-border rounded px-1.5 py-0.5 text-[10px] text-text outline-none placeholder:text-dim"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateNote(); }}
            />
            <button onClick={handleCreateNote}
              className="p-1 rounded text-dim hover:text-text hover:bg-hover transition-colors" title="Add note"
            ><Plus size={12} /></button>
          </div>
        </div>
      </div>

      {/* Import sidebar */}
      {showImport && (
        <div className="w-56 shrink-0">
          <ImportPanel wsId={activeId} sessionId={sessionId} onPlace={handlePlace} />
        </div>
      )}
    </div>
  );
}
