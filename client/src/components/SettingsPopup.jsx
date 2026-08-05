import { useCallback, useEffect, useState } from "react";
import { Settings, User, Copy, Check } from "lucide-react";
import { getProfile, updateProfile } from "../api/profile";
import { useSearchStore, providers } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";

export default function SettingsPopup({ open, onToggle }) {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const provider = useSearchStore((s) => s.provider);
  const setProvider = useSearchStore((s) => s.setProvider);
  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);
  const sessionId = useSessionStore((s) => s.sessionId);

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

  return (
    <div className="relative shrink-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-center size-8 rounded-lg text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all duration-200"
        title="Settings"
      >
        <Settings size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-elevated/95 backdrop-blur-xl border border-violet-500/30 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2.5 text-xs font-bold text-muted uppercase tracking-wider border-b border-border/80 bg-surface/40 font-heading">
              Settings & Preferences
            </div>

            {/* Profile */}
            <div className="px-4 py-3 border-b border-border/80">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300 mb-2">
                <User size={13} />
                <span>User Profile</span>
              </div>
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your display name"
                    className="flex-1 px-2.5 py-1 text-xs rounded-xl bg-hover border border-border text-text outline-none focus:border-violet-500"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditing(false); }}
                  />
                  <button
                    onClick={handleSaveUsername}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text">{profile?.username || "Anonymous Researcher"}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
              <button
                onClick={handleCopySession}
                className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-dim hover:text-text transition-colors"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? "Copied Session ID!" : `ID: ${sessionId.slice(0, 12)}...`}</span>
              </button>
            </div>

            {/* Search provider */}
            <div className="px-4 py-3">
              <div className="text-xs font-semibold text-cyan-300 mb-2">Search Provider</div>
              <div className="space-y-1">
                {providers.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setProvider(p.value);
                      if (query) search(query.trim(), 1, p.value);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-all rounded-xl ${
                      provider === p.value
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm font-semibold"
                        : "text-muted hover:text-text hover:bg-hover"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

