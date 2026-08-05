import React, { useState } from 'react';
import { X, User, Settings, History as HistoryIcon, Bookmark, Sun, Moon, Wifi, ShieldOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfilePanel } from './ProfilePanel';
import { HistoryPanel } from '../History/HistoryPanel';
import { useSearch } from '../../context/SearchContext';
import { useSiteActions } from '../../context/SiteActionsContext';
import { useTheme } from '../../context/ThemeContext';
import { Pill } from '../common/Common';
import './ProfileSettingsModal.css';

export const ProfileSettingsModal = ({ isOpen, onClose, initialTab = 'settings' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const { bookmarks, toggleBookmark, blacklistedDomains, clearBlacklist } = useSiteActions();
  const { theme, setTheme } = useTheme();
  const { isOffline, setIsOffline } = useSearch();

  if (!isOpen) return null;

  const tabs = [
    { id: 'settings', label: 'Profile & Settings', icon: Settings },
    { id: 'history', label: 'Activity History', icon: HistoryIcon },
    { id: 'saved', label: 'Saved Bookmarks', icon: Bookmark },
  ];

  return (
    <AnimatePresence>
      <div className="settings-modal-backdrop" onClick={onClose}>
        <motion.div
          className="settings-modal-card glass-panel"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Modal Header */}
          <div className="settings-modal-header">
            <h3 className="settings-modal-title font-heading">
              <User size={18} color="var(--accent-primary)" />
              Account & Application Preferences
            </h3>
            <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Close Modal">
              <X size={18} />
            </button>
          </div>

          {/* Modal Tabs */}
          <div className="settings-modal-tabs">
            {tabs.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`modal-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeModalTab"
                      className="modal-tab-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <IconComp size={14} style={{ zIndex: 1 }} />
                  <span style={{ zIndex: 1 }}>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body Content */}
          <div className="settings-modal-body">
            {activeTab === 'settings' && (
              <div className="modal-section-stack">
                <div className="settings-group">
                  <h4 className="settings-group-title font-heading">User Profile</h4>
                  <ProfilePanel />
                </div>

                <div className="settings-group" style={{ marginTop: '16px' }}>
                  <h4 className="settings-group-title font-heading">Appearance Theme</h4>
                  <div className="settings-theme-buttons">
                    <Pill active={theme === 'dark'} onClick={() => setTheme('dark')}>
                      <Moon size={14} /> Electric Dark Mode
                    </Pill>
                    <Pill active={theme === 'light'} onClick={() => setTheme('light')}>
                      <Sun size={14} /> Minimal Light Mode
                    </Pill>
                  </div>
                </div>

                <div className="settings-group" style={{ marginTop: '16px' }}>
                  <h4 className="settings-group-title font-heading">Network Mode</h4>
                  <Pill active={isOffline} onClick={() => setIsOffline(!isOffline)}>
                    <Wifi size={14} /> {isOffline ? '🔴 Offline Mode' : '🟢 Online Mode'}
                  </Pill>
                </div>

                <div className="settings-group" style={{ marginTop: '16px' }}>
                  <h4 className="settings-group-title font-heading">Domain Management</h4>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {blacklistedDomains.length} domain(s) currently blocked.
                  </p>
                  {blacklistedDomains.length > 0 && (
                    <button type="button" className="pill" onClick={clearBlacklist}>
                      <ShieldOff size={14} /> Clear all blacklisted domains
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <HistoryPanel />
            )}

            {activeTab === 'saved' && (
              <div className="saved-bookmarks-list">
                {bookmarks.length === 0 ? (
                  <div className="empty-media-msg">No bookmarked sites yet. Click 🔖 on any card to save it.</div>
                ) : (
                  bookmarks.map(site => (
                    <div key={site.id || site.url} className="saved-card">
                      <div className="saved-card-header">
                        <img src={site.favicon || `https://www.google.com/s2/favicons?domain=${site.domain || (site.url ? new URL(site.url).hostname : 'web')}&sz=32`} alt="" className="result-favicon" />
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="saved-card-title">
                          {site.title}
                        </a>
                      </div>
                      <p className="saved-card-snippet">{site.snippet}</p>
                      <button type="button" className="remove-saved-btn" onClick={() => toggleBookmark(site)}>
                        Remove bookmark
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
