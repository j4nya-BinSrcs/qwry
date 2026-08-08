import { useCallback, useEffect, useState } from 'react';
import {
  Settings, Sun, Moon, Flame, User, Copy, Check, Plus, Trash2, Pencil,
  MoonStar, Leaf, Flower, Snowflake, Search,
} from 'lucide-react';
import { getProfile, updateProfile, listProfiles, createProfile, deleteProfile } from '../../api/profile';
import { useSearchStore, providers } from '../../stores/searchStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useUIStore } from '../../stores/uiStore';
import BentoPixelBg from './BentoPixelBg';
import ConfirmDialog from '../ConfirmDialog';

const THEME_OPTIONS = [
  { id: 'latte', label: 'Latte', icon: Sun },
  { id: 'mocha', label: 'Mocha', icon: Moon },
  { id: 'tokyo-night', label: 'Tokyo Night', icon: MoonStar },
  { id: 'everforest', label: 'Everforest', icon: Leaf },
  { id: 'rose-pine', label: 'Rosé Pine', icon: Flower },
  { id: 'gruvbox', label: 'Gruvbox', icon: Flame },
  { id: 'frosted-glass', label: 'Frosted', icon: Snowflake },
];

function sortProfiles(list) {
  return [...list].sort((a, b) => {
    const an = (a.username || 'Anonymous').toLowerCase();
    const bn = (b.username || 'Anonymous').toLowerCase();
    const c = an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
    if (c !== 0) return c;
    return a.session_id.localeCompare(b.session_id);
  });
}

export default function BentoSettingsCard() {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteProfileTarget, setDeleteProfileTarget] = useState(null);

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
        setUsername(p.username || '');
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
    loadProfile();
    loadProfiles();
  }, [loadProfile, loadProfiles]);

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
      setUsername(p.username || '');
      setCreating(false);
      setNewName('');
      loadProfiles();
    }
  };

  const handleSwitchProfile = async (targetSessionId) => {
    if (targetSessionId === sessionId) return;
    setSessionId(targetSessionId);
    const p = await getProfile();
    if (p) {
      setProfile(p);
      setUsername(p.username || '');
    }
    loadProfiles();
  };

  const handleDeleteProfile = (targetSessionId) => {
    if (profiles.length <= 1) return;
    setDeleteProfileTarget(targetSessionId);
  };

  const handleDeleteProfileConfirm = useCallback(async () => {
    if (!deleteProfileTarget) return;
    const targetSessionId = deleteProfileTarget;
    await deleteProfile(targetSessionId);
    if (targetSessionId === sessionId) {
      const remaining = profiles.filter((p) => p.session_id !== targetSessionId);
      if (remaining.length > 0) {
        setSessionId(remaining[0].session_id);
        setProfile(remaining[0]);
        setUsername(remaining[0].username || '');
      }
    }
    loadProfiles();
    setDeleteProfileTarget(null);
  }, [deleteProfileTarget, profiles, sessionId]);

  const handleDeleteProfileCancel = useCallback(() => {
    setDeleteProfileTarget(null);
  }, []);

  return (
    <div className="bento-card-inner bento-settings-card">
      <BentoPixelBg opacity={0.28} />
      <div className="bento-settings-content">
        <div className="bento-card-header">
          <div className="bento-card-title">
            <Settings size={14} />
            Settings
          </div>
        </div>

        {/* Active profile — standalone banner */}
        <div className="bento-active-profile">
          {editing ? (
            <div className="bento-profile-edit">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="bento-settings-input"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveUsername(); if (e.key === 'Escape') setEditing(false); }}
              />
              <button onClick={handleSaveUsername} className="bento-settings-save">
                Save
              </button>
            </div>
          ) : (
            <>
              <div className="bento-active-avatar">
                {(profile?.username || 'A').charAt(0)}
              </div>
              <div className="bento-active-meta">
                <span className="bento-active-name">{profile?.username || 'Anonymous'}</span>
                <span className="bento-active-sub">Session {sessionId.slice(0, 8)}…</span>
              </div>
              <div className="bento-active-actions">
                <button onClick={() => setEditing(true)} title="Edit name">
                  <Pencil size={11} />
                  Edit
                </button>
                <button onClick={handleCopySession} title="Copy session ID">
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bento-settings-grid">
          {/* Theme */}
          <section className="bento-settings-section">
            <h4 className="bento-settings-section-title">Theme</h4>
            <div className="bento-theme-grid">
              {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={`bento-theme-option ${theme === id ? 'is-active' : ''}`}
                  title={label}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Profiles */}
          <section className="bento-settings-section">
            <h4 className="bento-settings-section-title">
              <User size={12} />
              Profiles <span className="bento-settings-count">{profiles.length}</span>
              {creating ? (
                <div className="bento-profile-edit bento-profile-edit--inline">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Profile name"
                    className="bento-settings-input"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProfile(); if (e.key === 'Escape') setCreating(false); }}
                  />
                  <button onClick={handleCreateProfile} className="bento-settings-save">
                    Add
                  </button>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="bento-profile-new bento-profile-new--inline">
                  <Plus size={12} />
                  New profile
                </button>
              )}
            </h4>
            <div className="bento-profile-list">
              {profiles.filter((p) => p.session_id !== sessionId).map((p) => (
                <div
                  key={p.session_id}
                  className="bento-profile-row"
                  onClick={() => handleSwitchProfile(p.session_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSwitchProfile(p.session_id);
                    }
                  }}
                >
                  <span className="truncate flex-1">{p.username || 'Anonymous'}</span>
                  {profiles.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProfile(p.session_id); }}
                      className="bento-settings-link text-dim hover:text-red-400"
                      title="Delete profile"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Search provider */}
          <section className="bento-settings-section">
            <h4 className="bento-settings-section-title">
              <Search size={12} />
              Search Provider
            </h4>
            <div className="bento-provider-list">
              {providers.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setProvider(p.value);
                    if (query) search(query.trim(), 1, p.value);
                  }}
                  className={`bento-provider-option ${provider === p.value ? 'is-active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteProfileTarget}
        title="Delete profile?"
        message="This will permanently remove this session profile and all its local data."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteProfileConfirm}
        onCancel={handleDeleteProfileCancel}
      />
    </div>
  );
}
