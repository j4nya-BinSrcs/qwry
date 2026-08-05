import { Layers, Moon, Plus, Search, Settings, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import SettingsPopup from "../components/SettingsPopup";

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

const THUMB_HEIGHTS = [168, 200, 184, 216];
const MAX_TILES = 6;

function faviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function GradientTile({ seed }) {
  const grad = GRADIENTS[hashString(seed) % GRADIENTS.length];
  return (
    <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }} />
  );
}

function FaviconTile({ domain }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <GradientTile seed={domain} />;
  return (
    <div className="w-full h-full bg-hover/50 flex items-center justify-center">
      <img
        src={faviconUrl(domain)}
        alt=""
        loading="lazy"
        className="size-7 rounded-sm"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function WorkspaceThumb({ ws, items }) {
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

  const height = THUMB_HEIGHTS[hashString(ws.id) % THUMB_HEIGHTS.length];
  const shown = allDomains.slice(0, MAX_TILES);
  const extra = Math.max(0, allDomains.length - MAX_TILES);

  if (allDomains.length === 0) {
    return (
      <div className="w-full relative" style={{ height }}>
        <GradientTile seed={ws.id} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Layers size={22} className="text-surface/80" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative" style={{ height }}>
      <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-0.5">
        {shown.map((d) => <FaviconTile key={d} domain={d} />)}
        {Array.from({ length: MAX_TILES - shown.length }).map((_, i) => (
          <GradientTile key={`placeholder-${i}`} seed={`${ws.id}-${i}`} />
        ))}
      </div>
      {extra > 0 && (
        <span className="absolute bottom-1.5 right-1.5 bg-accent text-surface text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function HomeView() {
  const sessionId = useSessionStore((s) => s.sessionId);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const itemsByWorkspace = useWorkspaceStore((s) => s.itemsByWorkspace);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const loadAllItems = useWorkspaceStore((s) => s.loadAllItems);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const setContextMode = useUIStore((s) => s.setContextMode);

  const [quickQuery, setQuickQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0) {
      loadAllItems(sessionId, workspaces);
    }
  }, [sessionId, workspaces, loadAllItems]);

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

  return (
    <div className="h-full overflow-y-auto relative">
      {/* Top controls */}
      <div className="sticky top-0 z-10 flex items-center justify-end gap-2 px-6 py-3 bg-surface/80 backdrop-blur-sm">
        <button onClick={toggleTheme}
          className="flex items-center justify-center size-7 rounded text-dim hover:text-text hover:bg-hover transition-colors"
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >{theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}</button>
        <SettingsPopup open={settingsOpen} onToggle={() => setSettingsOpen(!settingsOpen)} />
      </div>

      <div className="mx-auto max-w-5xl px-8 pt-12 pb-16">
        {/* Hero section */}
        <div className="text-center mb-14">
          <div className="size-14 rounded-2xl bg-accent mb-5 flex items-center justify-center mx-auto shadow-lg shadow-accent/25">
            <span className="text-surface text-2xl font-bold">Q</span>
          </div>
          <h1 className="text-3xl font-semibold text-text tracking-wide">QWRY</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">Search, save, summarize, and organize your research.</p>
        </div>

        {/* Search */}
        <form onSubmit={handleQuickSearch} className="mb-14">
          <div className="relative max-w-xl mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
            <input type="text" value={quickQuery} onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search the web..."
              className="w-full h-12 pl-10 pr-4 rounded-2xl bg-elevated border border-border text-sm text-text outline-none placeholder:text-dim focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-sm"
            />
          </div>
        </form>

        {/* Workspaces */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Workspaces</h2>
            <button onClick={handleCreateWs}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
            ><Plus size={13} /> New</button>
          </div>

          {workspaces.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-border">
              <Layers size={24} className="text-dim mx-auto mb-3" />
              <p className="text-sm text-muted">No workspaces yet</p>
              <button onClick={handleCreateWs}
                className="mt-4 text-sm px-4 py-2 rounded-lg bg-accent text-surface hover:bg-accent-hover transition-colors"
              >Create your first workspace</button>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5">
              {workspaces.map((ws) => (
                <button key={ws.id} onClick={() => handleWsClick(ws.id)}
                  className="block w-full mb-5 break-inside-avoid text-left bg-panel border border-border rounded-2xl overflow-hidden hover:border-accent/60 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                >
                  <WorkspaceThumb ws={ws} items={itemsByWorkspace[ws.id] || []} />
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{ws.name}</p>
                      <p className="text-xs text-muted mt-0.5">{ws.item_count ?? 0} items</p>
                    </div>
                    <Layers size={14} className="text-dim shrink-0 group-hover:text-accent transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
