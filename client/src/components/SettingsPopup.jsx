import { useCallback, useEffect, useState } from "react";
import { Settings, Sun, Moon, User, Copy, Check, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { getProfile, updateProfile, listProfiles, createProfile, deleteProfile } from "../api/profile";
import { useSearchStore, providers } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";

export default function SettingsPopup({ open, onToggle }) {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [showProfiles, setShowProfiles] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const provider = useSearchStore((s) => s.provider);
  const setProvider = useSearchStore((s) => s.setProvider);
  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);
  const sessionId = useSessionStore((s) => s.sessionId);
  const setSessionId = useSessionStore((s) => s.setSessionId);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getProfile();
      if (p) {
        setProfile(p);
        setUsername(p.username || "");
      }
    } catch {}
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const ps = await listProfiles();
      setProfiles(ps);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      loadProfile();
      loadProfiles();
    }
  }, [open, loadProfile, loadProfiles]);

  const handleSaveUsername = async () => {
    const p = await updateProfile({ username: username.trim() || null, search_provider: provider });
    if (p) setProfile(p);
    setEditing(false);
    loadProfiles();
  };

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateProfile = async () => {
    if (!newName.trim()) return;
    const p = await createProfile(newName.trim());
    if (p) {
      setSessionId(p.session_id);
      setProfile(p);
      setUsername(p.username || "");
      setCreating(false);
      setNewName("");
      loadProfiles();
    }
  };

  const handleSwitchProfile = async (targetSessionId) => {
    if (targetSessionId === sessionId) return;
    setSessionId(targetSessionId);
    const p = await getProfile();
    if (p) {
      setProfile(p);
      setUsername(p.username || "");
    }
    loadProfiles();
  };

  const handleDeleteProfile = async (targetSessionId) => {
    if (profiles.length <= 1) return;
    await deleteProfile(targetSessionId);
    if (targetSessionId === sessionId) {
      const remaining = profiles.filter((p) => p.session_id !== targetSessionId);
      if (remaining.length > 0) {
        setSessionId(remaining[0].session_id);
        setProfile(remaining[0]);
        setUsername(remaining[0].username || "");
      }
    }
    loadProfiles();
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
          <div className="absolute top-full right-0 mt-1 w-72 rounded-lg bg-elevated border border-border overflow-hidden z-50 max-h-[80vh] overflow-y-auto">
            <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border">
              Settings
            </div>

            {/* Theme */}
            <div className="px-3 py-2 border-b border-border">
              <div className="text-xs text-muted mb-1.5">Theme</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => theme !== "light" && toggleTheme()}
                  className={`flex items-center gap-1.5 flex-1 px-2 py-1.5 text-left text-xs transition-colors rounded ${
                    theme === "light"
                      ? "bg-text text-surface"
                      : "text-text hover:bg-hover"
                  }`}
                >
                  <Sun size={12} />
                  Light
                </button>
                <button
                  onClick={() => theme !== "dark" && toggleTheme()}
                  className={`flex items-center gap-1.5 flex-1 px-2 py-1.5 text-left text-xs transition-colors rounded ${
                    theme === "dark"
                      ? "bg-text text-surface"
                      : "text-text hover:bg-hover"
                  }`}
                >
                  <Moon size={12} />
                  Dark
                </button>
              </div>
            </div>

            {/* Profiles */}
            <div className="px-3 py-2 border-b border-border">
              <button
                onClick={() => setShowProfiles(!showProfiles)}
                className="flex items-center gap-1.5 w-full text-xs text-muted mb-1.5"
              >
                {showProfiles ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <User size={12} />
                <span>Profiles</span>
                <span className="text-dim ml-auto">{profiles.length}</span>
              </button>

              {showProfiles && (
                <div className="space-y-1">
                  {/* Current profile name */}
                  <div className="flex items-center justify-between px-1 py-0.5">
                    {editing ? (
                      <div className="flex items-center gap-1 flex-1">
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
                          className="px-2 py-1 text-[14px] rounded bg-text text-surface hover:bg-text/80 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-text">{profile?.username || "Anonymous"}</span>
                        <button
                          onClick={() => setEditing(true)}
                          className="text-[14px] text-dim hover:text-text transition-colors"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>

                  {/* Session ID */}
                  <button
                    onClick={handleCopySession}
                    className="flex items-center gap-1 text-[14px] text-dim hover:text-text transition-colors px-1"
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? "Copied!" : `Session: ${sessionId.slice(0, 8)}...`}
                  </button>

                  {/* Profile list */}
                  <div className="mt-1.5 space-y-0.5">
                    {profiles.map((p) => (
                      <div
                        key={p.session_id}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                          p.session_id === sessionId
                            ? "bg-text text-surface"
                            : "text-text hover:bg-hover"
                        }`}
                        onClick={() => handleSwitchProfile(p.session_id)}
                      >
                        <span className="flex-1 truncate">
                          {p.username || "Anonymous"}
                        </span>
                        {p.session_id === sessionId && (
                          <span className="text-[14px] opacity-70">active</span>
                        )}
                        {profiles.length > 1 && p.session_id !== sessionId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.session_id); }}
                            className="shrink-0 text-dim hover:text-red-400 transition-colors"
                            title="Delete profile"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Create new */}
                  {creating ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Profile name"
                        className="flex-1 px-2 py-1 text-xs rounded bg-hover border border-border text-text outline-none focus:border-text"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateProfile(); if (e.key === "Escape") setCreating(false); }}
                      />
                      <button
                        onClick={handleCreateProfile}
                        className="px-2 py-1 text-[14px] rounded bg-text text-surface hover:bg-text/80 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreating(true)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[14px] text-dim hover:text-text transition-colors"
                    >
                      <Plus size={10} />
                      New profile
                    </button>
                  )}
                </div>
              )}
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
                      ? "bg-text text-surface"
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
