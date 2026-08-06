import { Layers, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import SettingsPopup from "../components/SettingsPopup";
import SmokeBackground from "../components/SmokeBackground";

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

const GRADIENTS = [
  ["#0d5c63", "#083b40"],
  ["#147078", "#0d4f56"],
  ["#3a5f6b", "#243f49"],
  ["#4e4b5c", "#35333f"],
  ["#6b6486", "#464057"],
  ["#596e8a", "#37445c"],
];

const CAT_TILES = [4, 6, 8];
const CAT_COLS = [2, 3, 4];
const CAT_SPANS = [8, 9, 11];
const FAV_SIZE = [16, 20, 24];
const HOVER_GROW = 3;

const PHRASES = [
  "Search the web...",
  "Save your research...",
  "Study the results...",
  "Organize your ideas...",
];

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function gradientStyle(seed) {
  const grad = GRADIENTS[hashString(seed) % GRADIENTS.length];
  return { background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` };
}

function GradientTile({ seed }) {
  return <div className="w-full h-full" style={gradientStyle(seed)} />;
}

function GradientSquare({ seed, size }) {
  return <div style={{ width: size, height: size, borderRadius: 4, ...gradientStyle(seed) }} />;
}

function FaviconTile({ domain, size }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <GradientSquare seed={domain} size={size} />;
  return (
    <img
      src={faviconUrl(domain)}
      alt=""
      loading="lazy"
      className="rounded-[3px]"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

function WorkspaceThumb({ ws, items, cat }) {
  const tiles = CAT_TILES[cat];
  const cols = CAT_COLS[cat];
  const favSize = FAV_SIZE[cat];
  const allDomains = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const it of items || []) {
      const d = getHostname(it.url);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }, [items]);

  const shown = allDomains.slice(0, tiles);
  const extra = Math.max(0, allDomains.length - tiles);

  if (allDomains.length === 0) {
    return (
      <div className="w-full relative flex-1 min-h-0 overflow-hidden">
        <GradientTile seed={ws.id} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Layers size={12} className="text-surface/80" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative flex-1 min-h-0 overflow-hidden">
      <GradientTile seed={ws.id} />
      <div className="absolute inset-0 flex items-center justify-center p-1">
        <div
          className="grid gap-px group-hover:scale-110 transition-transform duration-700 ease-out will-change-transform"
          style={{ gridTemplateColumns: `repeat(${cols}, auto)`, justifyItems: "center", alignItems: "center" }}
        >
          {shown.map((d) => <FaviconTile key={d} domain={d} size={favSize} />)}
          {Array.from({ length: tiles - shown.length }).map((_, i) => (
            <GradientSquare key={`placeholder-${i}`} seed={`${ws.id}-${i}`} size={favSize} />
          ))}
        </div>
      </div>
      {extra > 0 && (
        <span className="absolute bottom-1 right-1 bg-accent text-surface text-[9px] font-semibold px-1 py-px rounded-full">
          +{extra}
        </span>
      )}
    </div>
  );
}

function cardParams(ws, items) {
  const count = ws.item_count ?? items?.length ?? 0;
  const cat = count >= 10 ? 2 : count > 4 ? 1 : 0;
  return { cat, span: CAT_SPANS[cat] };
}

function useTypewriter(paused) {
  const [text, setText] = useState("");
  const state = useRef({ phrase: 0, char: 0, deleting: false });

  useEffect(() => {
    if (paused) return;
    let timer;
    const tick = () => {
      const { phrase, char, deleting } = state.current;
      const current = PHRASES[phrase];
      if (!deleting) {
        const next = char + 1;
        state.current.char = next;
        setText(current.slice(0, next));
        if (next === current.length) {
          state.current.deleting = true;
          timer = setTimeout(tick, 1800);
        } else {
          timer = setTimeout(tick, 50);
        }
      } else {
        const next = char - 1;
        state.current.char = next;
        setText(current.slice(0, next));
        if (next === 0) {
          state.current.deleting = false;
          state.current.phrase = (phrase + 1) % PHRASES.length;
          timer = setTimeout(tick, 350);
        } else {
          timer = setTimeout(tick, 26);
        }
      }
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [paused]);

  return text;
}

export default function HomeView() {
  const sessionId = useSessionStore((s) => s.sessionId);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const itemsByWorkspace = useWorkspaceStore((s) => s.itemsByWorkspace);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const loadAllItems = useWorkspaceStore((s) => s.loadAllItems);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [quickQuery, setQuickQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0) {
      loadAllItems(sessionId, workspaces);
    }
  }, [sessionId, workspaces, loadAllItems]);

  const placeholder = useTypewriter(focused || quickQuery.length > 0);

  const handleQuickSearch = useCallback((e) => {
    e.preventDefault();
    const q = quickQuery.trim();
    if (!q) return;
    setSearchQuery(q);
    search(q);
    setContextMode("search-assist");
  }, [quickQuery, setSearchQuery, search, setContextMode]);

  const handleCreateWs = useCallback(async () => {
    const name = prompt("Workspace name:");
    if (name) await createWorkspace(sessionId, name);
  }, [sessionId, createWorkspace]);

  const handleWsClick = useCallback((wsId) => {
    setActive(wsId);
    setContextMode("workspace");
  }, [setActive, setContextMode]);

  const handleDeleteWs = useCallback((e, wsId) => {
    e.stopPropagation();
    if (window.confirm("Delete this workspace?")) {
      deleteWorkspace(sessionId, wsId);
    }
  }, [sessionId, deleteWorkspace]);

  return (
    <div className="h-full overflow-hidden relative flex flex-col">
      <SmokeBackground />

      {/* Top controls */}
      <div className="relative z-40 flex flex-shrink-0 items-center justify-end gap-2 px-6 py-3">
        <SettingsPopup open={settingsOpen} onToggle={() => setSettingsOpen(!settingsOpen)} />
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col">
        {/* Top: brand + search */}
        <div className="flex-[2] flex items-end justify-center px-8 pb-10">
          <div className="mx-auto w-full max-w-xl">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <div className="size-10 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/25">
                <span className="text-surface text-base font-bold">Q</span>
              </div>
              <h1 className="text-xl font-semibold text-text tracking-wide">QWRY</h1>
            </div>
            <p className="text-[11px] text-muted text-center mb-4">Search, save, summarize, and organize your research.</p>

            <form onSubmit={handleQuickSearch}>
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
                <input type="text" value={quickQuery} onChange={(e) => setQuickQuery(e.target.value)}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  placeholder={placeholder}
                  className="w-full h-10 pl-10 pr-4 rounded-2xl bg-elevated border border-border text-sm text-text outline-none placeholder:text-dim focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Bottom: workspace selector */}
        <div className="flex-[8] min-h-0 flex items-start justify-center">
          <div className="flex flex-col h-[90%] w-[50%] border border-border rounded-2xl overflow-hidden bg-surface/60">
            <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
              <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Workspaces</h2>
              <button onClick={handleCreateWs}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-accent hover:bg-accent hover:text-surface transition-colors"
              ><Plus size={12} /> New</button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3 pb-5">
              {workspaces.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed border-border">
                  <Layers size={24} className="text-dim mx-auto mb-3" />
                  <p className="text-sm text-muted">No workspaces yet</p>
                  <button onClick={handleCreateWs}
                    className="mt-4 text-sm px-4 py-2 rounded-lg bg-accent text-surface hover:bg-accent-hover transition-colors"
                  >Create your first workspace</button>
                </div>
              ) : (
                <div className="ws-grid gap-3">
                  {workspaces.map((ws) => {
                    const items = itemsByWorkspace[ws.id] || [];
                    const { cat, span } = cardParams(ws, items);
                    return (
                      <div key={ws.id} role="button" tabIndex={0}
                        onClick={() => handleWsClick(ws.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleWsClick(ws.id);
                        }}
                        className="ws-card group w-full text-left bg-panel border border-border rounded-lg overflow-hidden cursor-pointer flex flex-col"
                        style={{ "--rows": span, "--rows-hover": span + HOVER_GROW }}
                      >
                        <WorkspaceThumb ws={ws} items={items} cat={cat} />
                        <div className="px-2 py-1.5 flex items-center justify-between gap-1.5">
                          <div className="min-w-0 flex items-baseline gap-1">
                            <p className="text-[11px] font-medium text-text truncate">{ws.name}</p>
                            <span className="text-[9px] font-normal text-dim shrink-0">{ws.item_count ?? items.length}</span>
                          </div>
                          <button type="button" onClick={(e) => handleDeleteWs(e, ws.id)}
                            className="flex items-center justify-center size-5 rounded-md text-dim hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                            title="Delete workspace"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
