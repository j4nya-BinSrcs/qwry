import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, Search, Sun, Moon, Flame, User, Copy, Check, Plus, Trash2, ChevronDown, ChevronRight, MoonStar, Leaf, Flower, Snowflake } from "lucide-react";
import { getProfile, updateProfile, listProfiles, createProfile, deleteProfile } from "../api/profile";
import { useSearchStore, providers } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";

const THEME_OPTIONS = [
  { id: "latte", label: "Light (Latte)", icon: Sun },
  { id: "mocha", label: "Dark (Mocha)", icon: Moon },
  { id: "tokyo-night", label: "Tokyo Night", icon: MoonStar },
  { id: "everforest", label: "Everforest", icon: Leaf },
  { id: "rose-pine", label: "Rosé Pine", icon: Flower },
  { id: "gruvbox", label: "Gruvbox Dark", icon: Flame },
  { id: "frosted-glass", label: "Frosted Glass", icon: Snowflake },
];

function sortProfiles(list) {
  return [...list].sort((a, b) => {
    const an = (a.username || "Anonymous").toLowerCase();
    const bn = (b.username || "Anonymous").toLowerCase();
    const c = an.localeCompare(bn, undefined, { numeric: true, sensitivity: "base" });
    if (c !== 0) return c;
    return a.session_id.localeCompare(b.session_id);
  });
}

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
  const setTheme = useUIStore((s) => s.setTheme);
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
      setProfiles(sortProfiles(ps));
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
        className="flex items-center justify-center size-7 rounded-md border border-border text-text hover:bg-hover transition-colors"
        title="Settings"
      >
        <Settings size={16} />
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
          <div className="fixed top-16 right-4 z-50 w-72 rounded-xl border border-border bg-elevated shadow-pop overflow-hidden max-h-[80vh] overflow-y-auto qwry-dropdown animate-pop-in">
            <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border qwry-popup-header">
              Settings
            </div>

            {/* Theme */}
            <div className="px-3 py-2 border-b border-border">
              <div className="qwry-popup-section-title">
                <Sun size={12} />
                Theme
              </div>
              <div className="qwry-popup-list">
                {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id)}
                    className={`qwry-popup-item ${theme === id ? 'is-active' : ''}`}
                  >
                    <span className="qwry-popup-item-icon">
                      <Icon size={15} />
                    </span>
                    <span className="qwry-popup-item-label">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Profiles */}
            <div className="px-3 py-2">
              <button
                onClick={() => setShowProfiles(!showProfiles)}
                className="flex items-center gap-2 w-full text-xs text-muted mb-2"
              >
                {showProfiles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <User size={14} />
                <span>Profiles</span>
                <span className="qwry-popup-item-count">{profiles.length}</span>
              </button>

              {showProfiles && (
                <div className="qwry-popup-list">
                  {/* Current profile name */}
                  <div className="flex items-center justify-between px-1 py-1">
                    {editing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Your name"
                          className="qwry-popup-input"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") setEditing(false); }}
                        />
                        <button onClick={handleSaveUsername} className="qwry-popup-btn qwry-popup-btn--primary">
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-text">{profile?.username || "Anonymous"}</span>
                        <button
                          onClick={() => setEditing(true)}
                          className="text-xs text-dim hover:text-text transition-colors"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>

                  {/* Session ID */}
                  <button
                    onClick={handleCopySession}
                    className="qwry-popup-item"
                  >
                    <span className="qwry-popup-item-icon">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </span>
                    <span className="qwry-popup-item-label">
                      {copied ? "Copied!" : `Session: ${sessionId.slice(0, 8)}...`}
                    </span>
                  </button>

                  {/* Profile list */}
                  {profiles.map((p) => (
                    <div
                      key={p.session_id}
                      className={`qwry-popup-item ${p.session_id === sessionId ? 'is-active' : ''}`}
                      onClick={() => handleSwitchProfile(p.session_id)}
                      role="button"
                    >
                      <span className="qwry-popup-item-label truncate">
                        {p.username || "Anonymous"}
                      </span>
                      {p.session_id === sessionId && (
                        <span className="qwry-popup-item-count">active</span>
                      )}
                      {profiles.length > 1 && p.session_id !== sessionId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.session_id); }}
                          className="qwry-popup-close hover:text-red-500"
                          title="Delete profile"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Create new */}
                  {creating ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Profile name"
                        className="qwry-popup-input"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateProfile(); if (e.key === "Escape") setCreating(false); }}
                      />
                      <button onClick={handleCreateProfile} className="qwry-popup-btn qwry-popup-btn--primary">
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreating(true)}
                      className="qwry-popup-item"
                    >
                      <span className="qwry-popup-item-icon">
                        <Plus size={14} />
                      </span>
                      <span className="qwry-popup-item-label">New profile</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Search provider */}
            <div className="px-3 py-2">
              <div className="qwry-popup-section-title">
                <Search size={12} />
                Search Provider
              </div>
              <div className="qwry-popup-list">
                {providers.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setProvider(p.value);
                      if (query) search(query.trim(), 1, p.value);
                    }}
                    className={`qwry-popup-item ${provider === p.value ? 'is-active' : ''}`}
                  >
                    <span className="qwry-popup-item-label">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
