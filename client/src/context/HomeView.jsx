import { BookOpen, Layers, Moon, Plus, Search, Settings, Sparkles, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useContentStore } from "../stores/contentStore";
import { useSearchStore } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import SettingsPopup from "../components/SettingsPopup";

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function timeAgo(date) {
  if (!date) return "";
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function HomeView() {
  const sessionId = useSessionStore((s) => s.sessionId);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);

  const reads = useContentStore((s) => s.reads);
  const summaries = useContentStore((s) => s.summaries);

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const search = useSearchStore((s) => s.search);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);

  const [quickQuery, setQuickQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

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

  const handleReadClick = useCallback((read) => {
    openReader(read.url, read.title, read.mediaUrl);
  }, [openReader]);

  const handleSummaryClick = useCallback((s) => {
    openSummarizer(s.url, s.title);
  }, [openSummarizer]);

  const recentReads = [...reads].reverse().slice(0, 5);
  const recentSummaries = [...summaries].reverse().slice(0, 5);

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

      <div className="mx-auto max-w-3xl px-8 pt-12 pb-16">
        {/* Hero section */}
        <div className="text-center mb-12">
          <div className="size-14 rounded-2xl bg-text mb-5 flex items-center justify-center mx-auto">
            <span className="text-surface text-2xl font-bold">Q</span>
          </div>
          <h1 className="text-2xl font-semibold text-text">Welcome to QWRY</h1>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">Your research workspace. Search, save, summarize, and organize.</p>
        </div>

        {/* Quick search */}
        <form onSubmit={handleQuickSearch} className="mb-14">
          <div className="relative max-w-lg mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
            <input type="text" value={quickQuery} onChange={(e) => setQuickQuery(e.target.value)}
              placeholder="Search the web or jump to a workspace..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-hover border border-border text-sm text-text outline-none placeholder:text-dim focus:border-text/50 transition-colors"
            />
          </div>
        </form>

        {/* Workspaces section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">Workspaces</h2>
            <button onClick={handleCreateWs}
              className="flex items-center gap-1.5 text-xs text-dim hover:text-text transition-colors"
            ><Plus size={13} /> New</button>
          </div>
          {workspaces.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-border">
              <Layers size={24} className="text-dim mx-auto mb-3" />
              <p className="text-sm text-muted">No workspaces yet</p>
              <button onClick={handleCreateWs}
                className="mt-3 text-sm px-4 py-2 rounded-lg bg-text text-surface hover:opacity-80 transition-opacity"
              >Create your first workspace</button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {workspaces.map((ws) => (
                <button key={ws.id} onClick={() => handleWsClick(ws.id)}
                  className="group shrink-0 w-44 h-28 bg-panel border border-border rounded-xl flex flex-col items-start justify-between p-4 hover:border-text/40 transition-all text-left"
                >
                  <Layers size={16} className="text-dim group-hover:text-text transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-text truncate max-w-full">{ws.name}</p>
                    <p className="text-xs text-muted mt-0.5">{ws.item_count ?? 0} items</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent Reads */}
          <div>
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">Recent Reads</h2>
            {recentReads.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-border">
                <BookOpen size={20} className="text-dim mx-auto mb-2" />
                <p className="text-xs text-muted">Open a source in Reader to see it here</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentReads.map((r) => (
                  <button key={r.id} onClick={() => handleReadClick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel border border-border hover:border-text/40 transition-all text-left"
                  >
                    <BookOpen size={14} className="text-dim shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{r.title || "Untitled"}</p>
                      <p className="text-xs text-muted truncate mt-0.5">{getHostname(r.url)}</p>
                    </div>
                    {r.created_at && <span className="text-[11px] text-dim shrink-0">{timeAgo(r.created_at)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Summaries */}
          <div>
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">Recent Summaries</h2>
            {recentSummaries.length === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-border">
                <Sparkles size={20} className="text-dim mx-auto mb-2" />
                <p className="text-xs text-muted">Summarize a source to see it here</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentSummaries.map((s) => (
                  <button key={s.id} onClick={() => handleSummaryClick(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-panel border border-border hover:border-text/40 transition-all text-left"
                  >
                    <Sparkles size={14} className="text-dim shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text truncate">{s.title || "Untitled"}</p>
                      <p className="text-xs text-muted truncate mt-0.5">{s.provider || getHostname(s.url)}</p>
                    </div>
                    {s.created_at && <span className="text-[11px] text-dim shrink-0">{timeAgo(s.created_at)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
