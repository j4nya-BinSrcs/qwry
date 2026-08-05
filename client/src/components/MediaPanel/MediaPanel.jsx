import React, { useState } from 'react';
import {
  LayoutGrid, Image as ImageIcon, Video, Newspaper, Bookmark, Link as LinkIcon, History as HistoryIcon, Settings, Moon, Sun, Wifi, ShieldOff
} from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useSiteActions } from '../../context/SiteActionsContext';
import { useTheme } from '../../context/ThemeContext';
import { ImageGrid } from './ImageGrid';
import { VideoList, NewsList } from './MediaViews';
import { Lightbox } from './Lightbox';
import { HistoryPanel } from '../History/HistoryPanel';
import { ProfilePanel } from '../Profile/ProfilePanel';
import { Pill } from '../common/Common';
import { motion, AnimatePresence } from 'framer-motion';
import './MediaPanel.css';

export const MediaPanel = () => {
  const { activeCategory, images, videos, news, isOffline, setIsOffline, results } = useSearch();
  const { bookmarks, toggleBookmark, blacklistedDomains, clearBlacklist } = useSiteActions();
  const { theme, setTheme } = useTheme();
  const [selectedImage, setSelectedImage] = useState(null);

  const getCategoryIcon = () => {
    switch (activeCategory) {
      case 'Images': return <ImageIcon size={18} color="var(--accent-primary)" />;
      case 'Videos': return <Video size={18} color="var(--accent-secondary)" />;
      case 'News': return <Newspaper size={18} color="var(--accent-tertiary)" />;
      case 'Saved': return <Bookmark size={18} color="var(--accent-primary)" />;
      case 'Links': return <LinkIcon size={18} color="var(--accent-secondary)" />;
      case 'History': return <HistoryIcon size={18} color="var(--accent-tertiary)" />;
      case 'Settings': return <Settings size={18} color="var(--accent-primary)" />;
      default: return <LayoutGrid size={18} color="var(--accent-primary)" />;
    }
  };

  return (
    <section className="column-panel media-panel glass-panel">
      {/* Header */}
      <div className="panel-header">
        <h2 className="panel-title font-heading">
          {getCategoryIcon()}
          {activeCategory}
        </h2>
      </div>

      {/* Content scroll area */}
      <div className="panel-scroll-area">
        <AnimatePresence mode="wait">
          {/* CATEGORY: ALL */}
          {activeCategory === 'All' && (
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="media-section-stack">
              <div className="media-group">
                <div className="media-group-title font-heading">
                  <ImageIcon size={14} color="var(--accent-primary)" />
                  <span>Images</span>
                  <span className="media-count">({images.length} total)</span>
                </div>
                <ImageGrid images={images} maxCount={4} onSelectImage={setSelectedImage} />
              </div>

              <div className="media-group">
                <div className="media-group-title font-heading">
                  <Video size={14} color="var(--accent-secondary)" />
                  <span>Videos</span>
                  <span className="media-count">({videos.length} total)</span>
                </div>
                <VideoList videos={videos} maxCount={4} />
              </div>
            </motion.div>
          )}

          {/* CATEGORY: IMAGES */}
          {activeCategory === 'Images' && (
            <motion.div key="images" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ImageGrid images={images} onSelectImage={setSelectedImage} />
            </motion.div>
          )}

          {/* CATEGORY: VIDEOS */}
          {activeCategory === 'Videos' && (
            <motion.div key="videos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <VideoList videos={videos} />
            </motion.div>
          )}

          {/* CATEGORY: NEWS */}
          {activeCategory === 'News' && (
            <motion.div key="news" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <NewsList articles={news} />
            </motion.div>
          )}

          {/* CATEGORY: SAVED / BOOKMARKS */}
          {activeCategory === 'Saved' && (
            <motion.div key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="saved-bookmarks-list">
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
            </motion.div>
          )}

          {/* CATEGORY: LINKS */}
          {activeCategory === 'Links' && (
            <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="saved-bookmarks-list">
              {results.map(site => (
                <div key={site.id || site.url} className="saved-card">
                  <div className="saved-card-header">
                    <img src={site.favicon || `https://www.google.com/s2/favicons?domain=${site.domain || (site.url ? new URL(site.url).hostname : 'web')}&sz=32`} alt="" className="result-favicon" />
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="saved-card-title">
                      {site.title}
                    </a>
                  </div>
                  <span className="result-domain">{site.url}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* CATEGORY: HISTORY */}
          {activeCategory === 'History' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HistoryPanel />
            </motion.div>
          )}

          {/* CATEGORY: SETTINGS */}
          {activeCategory === 'Settings' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="settings-container">
              <div className="settings-group">
                <h4 className="settings-group-title font-heading">User Profile Settings</h4>
                <ProfilePanel />
              </div>

              <div className="settings-group">
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

              <div className="settings-group">
                <h4 className="settings-group-title font-heading">Network Simulation</h4>
                <Pill active={isOffline} onClick={() => setIsOffline(!isOffline)}>
                  <Wifi size={14} /> {isOffline ? '🔴 Simulated Offline Mode (Click to Go Online)' : '🟢 Online Mode'}
                </Pill>
              </div>

              <div className="settings-group">
                <h4 className="settings-group-title font-heading">Site Management</h4>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {blacklistedDomains.length} domain(s) currently blocked.
                </p>
                {blacklistedDomains.length > 0 && (
                  <button type="button" className="pill" onClick={clearBlacklist}>
                    <ShieldOff size={14} /> Clear all blacklisted domains
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <Lightbox image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </section>
  );
};
