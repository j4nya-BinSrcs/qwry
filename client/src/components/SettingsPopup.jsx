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
        className="flex items-center justify-center size-7 rounded border border-border text-text hover:bg-hover transition-colors"
        title="Settings"
      >
        <Settings size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="absolute top-full right-0 mt-1 w-64 rounded-lg bg-white border border-border overflow-hidden z-50">
            <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border">
              Settings
            </div>

            {/* Profile */}
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                <User size={12} />
                Profile
              </div>
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 px-2 py-1 text-xs rounded bg-hover border border-border text-text outline-none focus:border-text"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditing(false); }}
                  />
                  <button
                    onClick={handleSaveUsername}
                    className="px-2 py-1 text-[10px] rounded bg-black text-white hover:bg-gray-800 transition-colors"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text">{profile?.username || "Anonymous"}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[10px] text-text hover:text-muted transition-colors"
                  >
                    Edit
                  </button>
                </div>
              )}
              <button
                onClick={handleCopySession}
                className="flex items-center gap-1 mt-1 text-[10px] text-dim hover:text-text transition-colors"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "Copied!" : `Session: ${sessionId.slice(0, 8)}...`}
              </button>
            </div>

            {/* Search provider */}
            <div className="px-3 py-2">
              <div className="text-xs text-muted mb-1.5">Search Provider</div>
              {providers.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setProvider(p.value);
                    if (query) search(query.trim(), 1, p.value);
                  }}
                  className={`w-full px-2 py-1.5 text-left text-xs transition-colors rounded ${
                    provider === p.value
                      ? "bg-black text-[#ffffff]"
                      : "text-text hover:bg-hover"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
