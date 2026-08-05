import { useCallback, useEffect, useState } from "react";
import { User, Copy, Check, Sun, Moon, Search, ShieldCheck, Edit2, X, Layers, Plus, BookOpen, Sparkles, History } from "lucide-react";
import { getProfile, updateProfile } from "../api/profile";
import { useSearchStore, providers } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useContentStore } from "../stores/contentStore";

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

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'workspaces' | 'activity'
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const provider = useSearchStore((s) => s.provider);
  const setProvider = useSearchStore((s) => s.setProvider);
  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);
  const sessionId = useSessionStore((s) => s.sessionId);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const openReader = useUIStore((s) => s.openReader);
  const openSummarizer = useUIStore((s) => s.openSummarizer);
  const openCreateWsModal = useUIStore((s) => s.openCreateWsModal);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setActiveWs = useWorkspaceStore((s) => s.setActiveWorkspace);
  const reads = useContentStore((s) => s.reads);
  const summaries = useContentStore((s) => s.summaries);

  const loadProfile = useCallback(async () => {
    const p = await getProfile();
    if (p) {
      setProfile(p);
      setUsername(p.username || "");
    }
  }, []);

  useEffect(() => {
    if (open) loadProfile();
  }, [open, loadProfile]);

  const handleSaveUsername = async () => {
    const p = await updateProfile({ username: username.trim() || null, search_provider: provider });
    if (p) setProfile(p);
    setEditing(false);
  };

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initialLetter = (profile?.username || "User").charAt(0).toUpperCase();
  const recentReads = [...reads].reverse().slice(0, 5);
  const recentSummaries = [...summaries].reverse().slice(0, 5);

  return (
    <div className="relative shrink-0 z-50">
      {/* Profile Avatar Button */}
      <button
        onClick={() => setOpen(!open)}
        className="size-8 rounded-full bg-gradient-to-tr from-violet-600 via-pink-500 to-cyan-400 p-[1.5px] shadow-md hover:shadow-violet-500/30 hover:scale-105 transition-all duration-300 cursor-pointer focus:outline-none"
        title="User Profile, Workspaces & Activity"
      >
        <div className="w-full h-full rounded-full bg-surface/90 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-text">
          {initialLetter}
        </div>
      </button>

      {/* Profile Dropdown Popup */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2.5 w-84 rounded-2xl bg-elevated/95 backdrop-blur-2xl border border-violet-500/30 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            
            {/* User Header */}
            <div className="p-4 border-b border-border/80 bg-surface/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-tr from-violet-600 via-pink-500 to-cyan-400 p-[1.5px] shadow-sm">
                  <div className="w-full h-full rounded-full bg-surface flex items-center justify-center text-sm font-black text-text">
                    {initialLetter}
                  </div>
                </div>
                <div className="min-w-0">
                  {editing ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your name"
                        className="w-28 px-2 py-0.5 text-xs rounded-lg bg-hover border border-border text-text outline-none focus:border-violet-500"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditing(false); }}
                      />
                      <button
                        onClick={handleSaveUsername}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-text font-heading truncate max-w-[130px]">
                        {profile?.username || "Researcher"}
                      </h3>
                      <button
                        onClick={() => setEditing(true)}
                        className="p-0.5 rounded text-dim hover:text-violet-300 transition-colors"
                        title="Edit name"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium mt-0.5">
                    <ShieldCheck size={10} /> Active Session
                  </span>
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-muted hover:text-text hover:bg-hover transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-border/80 bg-surface/30 px-2 pt-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex-1 py-2 text-[11px] font-semibold tracking-wider text-center border-b-2 transition-all ${
                  activeTab === "profile"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab("workspaces")}
                className={`flex-1 py-2 text-[11px] font-semibold tracking-wider text-center border-b-2 transition-all flex items-center justify-center gap-1 ${
                  activeTab === "workspaces"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                Workspaces ({workspaces.length})
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`flex-1 py-2 text-[11px] font-semibold tracking-wider text-center border-b-2 transition-all ${
                  activeTab === "activity"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                History
              </button>
            </div>

            {/* Tab 1: Profile & Settings */}
            {activeTab === "profile" && (
              <div className="max-h-80 overflow-y-auto">
                <div className="px-4 py-2.5 border-b border-border/80 bg-surface/20 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-dim">Session ID</span>
                  <button
                    onClick={handleCopySession}
                    className="flex items-center gap-1 text-[11px] font-mono text-violet-300 hover:text-violet-200 transition-colors"
                  >
                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copied ? "Copied!" : `${sessionId.slice(0, 10)}...`}</span>
                  </button>
                </div>

                <div className="p-4 border-b border-border/80 space-y-2">
                  <div className="text-[11px] font-bold text-muted uppercase tracking-wider font-heading">Theme Mode</div>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface/60 hover:bg-violet-500/15 border border-border/60 hover:border-violet-500/30 text-xs font-medium text-text transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? (
                        <Moon size={14} className="text-violet-400" />
                      ) : (
                        <Sun size={14} className="text-amber-400" />
                      )}
                      <span>{theme === "dark" ? "Dark Cosmic Mode" : "Light Horizon Mode"}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider group-hover:underline">
                      Switch
                    </span>
                  </button>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider font-heading">Search Engine</span>
                    <span className="text-[10px] text-cyan-300 font-mono capitalize">{provider}</span>
                  </div>
                  <div className="space-y-1">
                    {providers.map((p) => (
                      <button
                        key={p.label}
                        onClick={() => {
                          setProvider(p.value);
                          if (query) search(query.trim(), 1, p.value);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-all rounded-xl flex items-center justify-between ${
                          provider === p.value
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-semibold"
                            : "text-muted hover:text-text hover:bg-hover"
                        }`}
                      >
                        <span>{p.label}</span>
                        {provider === p.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Workspaces */}
            {activeTab === "workspaces" && (
              <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider font-heading">Your Workspaces</span>
                  <button
                    onClick={() => { setOpen(false); openCreateWsModal(); }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Plus size={12} /> New Workspace
                  </button>
                </div>

                {workspaces.length === 0 ? (
                  <div className="text-center py-8 rounded-xl bg-surface/30 border border-dashed border-border/60">
                    <Layers size={20} className="text-dim mx-auto mb-1.5" />
                    <p className="text-xs text-muted">No workspaces yet</p>
                    <button
                      onClick={() => { setOpen(false); openCreateWsModal(); }}
                      className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                    >
                      Create Workspace
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setActiveWs(ws.id);
                          setContextMode("workspace");
                          setOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface/50 hover:bg-violet-500/15 border border-border/60 hover:border-violet-500/30 text-left transition-all group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                            <Layers size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-text group-hover:text-violet-300 truncate">{ws.name}</p>
                            <p className="text-[10px] text-dim">{ws.item_count ?? 0} saved sources</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: History & Activity */}
            {activeTab === "activity" && (
              <div className="p-3 max-h-80 overflow-y-auto space-y-4">
                {/* Recent Reads */}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 font-heading">
                    <BookOpen size={12} /> Recent Reads
                  </div>
                  {recentReads.length === 0 ? (
                    <p className="text-[11px] text-dim italic px-1">No recent reads history</p>
                  ) : (
                    <div className="space-y-1">
                      {recentReads.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { openReader(r.url, r.title, r.mediaUrl); setOpen(false); }}
                          className="w-full text-left p-2 rounded-lg bg-surface/40 hover:bg-cyan-500/15 transition-colors group flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text group-hover:text-cyan-300 truncate">{r.title || "Untitled"}</p>
                            <p className="text-[10px] text-dim truncate">{getHostname(r.url)}</p>
                          </div>
                          {r.created_at && <span className="text-[9px] text-dim shrink-0">{timeAgo(r.created_at)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Summaries */}
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-pink-400 uppercase tracking-wider mb-1.5 font-heading">
                    <Sparkles size={12} /> Recent Summaries
                  </div>
                  {recentSummaries.length === 0 ? (
                    <p className="text-[11px] text-dim italic px-1">No recent summaries history</p>
                  ) : (
                    <div className="space-y-1">
                      {recentSummaries.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => { openSummarizer(s.url, s.title); setOpen(false); }}
                          className="w-full text-left p-2 rounded-lg bg-surface/40 hover:bg-pink-500/15 transition-colors group flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text group-hover:text-pink-300 truncate">{s.title || "Untitled"}</p>
                            <p className="text-[10px] text-dim truncate">{s.provider || getHostname(s.url)}</p>
                          </div>
                          {s.created_at && <span className="text-[9px] text-dim shrink-0">{timeAgo(s.created_at)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

