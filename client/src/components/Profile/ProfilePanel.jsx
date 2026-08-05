import React, { useState, useEffect } from 'react';
import { User, Save, Key, Globe, Clock, Check } from 'lucide-react';
import { getProfile, updateProfile } from '../../api/profile';
import { useSessionStore } from '../../stores/sessionStore';
import toast from 'react-hot-toast';
import './ProfilePanel.css';

export const ProfilePanel = () => {
  const sessionId = useSessionStore((state) => state.sessionId);
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [searchProvider, setSearchProvider] = useState('google');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      const data = await getProfile();
      if (isMounted && data) {
        setProfile(data);
        setUsername(data.username || '');
        setSearchProvider(data.search_provider || 'google');
      }
      setIsLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        username,
        search_provider: searchProvider
      });
      if (updated) {
        setProfile(updated);
        toast.success('Profile updated successfully!');
      } else {
        toast.error('Failed to update profile.');
      }
    } catch {
      toast.error('Error saving profile settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success('Session ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="empty-media-msg">Loading profile data...</div>;
  }

  return (
    <div className="profile-panel-container">
      <form onSubmit={handleSave} className="profile-card">
        <div className="profile-field">
          <label className="profile-label">
            <User size={13} style={{ display: 'inline', marginRight: '6px' }} />
            Display Name / Username
          </label>
          <input
            type="text"
            className="profile-input"
            placeholder="Enter your username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">
            <Globe size={13} style={{ display: 'inline', marginRight: '6px' }} />
            Preferred Search Provider
          </label>
          <select
            className="profile-select"
            value={searchProvider}
            onChange={(e) => setSearchProvider(e.target.value)}
          >
            <option value="google">Google Search (SearXNG)</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="searxng">SearXNG Default Aggregator</option>
            <option value="bing">Bing Search</option>
          </select>
        </div>

        <div className="profile-field">
          <label className="profile-label">
            <Key size={13} style={{ display: 'inline', marginRight: '6px' }} />
            Active Session Identifier (X-Session-Id)
          </label>
          <div>
            <span
              className="profile-badge"
              onClick={copySessionId}
              style={{ cursor: 'pointer' }}
              title="Click to copy Session ID"
            >
              {sessionId}
              {copied ? <Check size={12} /> : null}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="profile-save-btn"
          disabled={isSaving}
        >
          <Save size={15} />
          {isSaving ? 'Saving...' : 'Save Profile Settings'}
        </button>

        {profile && (
          <div className="profile-meta-row">
            <span>
              <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
              Created: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Active session'}
            </span>
            <span>
              Last Active: {profile.last_active ? new Date(profile.last_active).toLocaleTimeString() : 'Just now'}
            </span>
          </div>
        )}
      </form>
    </div>
  );
};
