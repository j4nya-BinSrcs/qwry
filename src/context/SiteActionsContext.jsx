import React, { createContext, useContext, useState } from 'react';
import toast from 'react-hot-toast';

const SiteActionsContext = createContext();

export const SiteActionsProvider = ({ children }) => {
  // Pinned Sites: [{ id, title, url, favicon, domain }]
  const [pinnedSites, setPinnedSites] = useState(() => {
    try {
      const saved = localStorage.getItem('qwry_pinned');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Blacklisted Domains: [domainString]
  const [blacklistedDomains, setBlacklistedDomains] = useState(() => {
    try {
      const saved = localStorage.getItem('qwry_blacklisted');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Bookmarked Items: [{ id, title, url, snippet, favicon, timestamp }]
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem('qwry_bookmarked');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Pin / Unpin Action
  const togglePin = (site) => {
    const isPinned = pinnedSites.some(p => p.id === site.id || p.url === site.url);
    if (isPinned) {
      const updated = pinnedSites.filter(p => p.id !== site.id && p.url !== site.url);
      setPinnedSites(updated);
      localStorage.setItem('qwry_pinned', JSON.stringify(updated));
      toast(`📌 ${site.domain || 'Site'} unpinned`, { style: toastStyle });
    } else {
      if (pinnedSites.length >= 10) {
        toast.error('Max 10 pins reached. Unpin one first.', { style: toastStyle });
        return;
      }
      const updated = [...pinnedSites, site];
      setPinnedSites(updated);
      localStorage.setItem('qwry_pinned', JSON.stringify(updated));
      toast.success(`📌 ${site.domain || 'Site'} pinned`, { style: toastStyle });
    }
  };

  // Blacklist Action with Undo
  const blacklistSite = (site) => {
    const domain = site.domain || new URL(site.url).hostname;
    if (blacklistedDomains.includes(domain)) return;

    const updated = [...blacklistedDomains, domain];
    setBlacklistedDomains(updated);
    localStorage.setItem('qwry_blacklisted', JSON.stringify(updated));

    toast(
      (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>🚫 {domain} blocked</span>
          <button
            onClick={() => {
              undoBlacklist(domain);
              toast.dismiss(t.id);
            }}
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-primary)',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000, style: toastStyle }
    );
  };

  const undoBlacklist = (domain) => {
    const updated = blacklistedDomains.filter(d => d !== domain);
    setBlacklistedDomains(updated);
    localStorage.setItem('qwry_blacklisted', JSON.stringify(updated));
    toast.success(`Restored ${domain}`, { style: toastStyle });
  };

  const clearBlacklist = () => {
    setBlacklistedDomains([]);
    localStorage.removeItem('qwry_blacklisted');
    toast.success('Blacklist cleared', { style: toastStyle });
  };

  // Bookmark Action
  const toggleBookmark = (site) => {
    const isBookmarked = bookmarks.some(b => b.id === site.id || b.url === site.url);
    if (isBookmarked) {
      const updated = bookmarks.filter(b => b.id !== site.id && b.url !== site.url);
      setBookmarks(updated);
      localStorage.setItem('qwry_bookmarked', JSON.stringify(updated));
      toast('🔖 Bookmark removed', { style: toastStyle });
    } else {
      const updated = [{ ...site, bookmarkedAt: new Date().toISOString() }, ...bookmarks];
      setBookmarks(updated);
      localStorage.setItem('qwry_bookmarked', JSON.stringify(updated));
      toast.success('🔖 Bookmarked', { style: toastStyle });
    }
  };

  return (
    <SiteActionsContext.Provider
      value={{
        pinnedSites,
        togglePin,
        blacklistedDomains,
        blacklistSite,
        undoBlacklist,
        clearBlacklist,
        bookmarks,
        toggleBookmark
      }}
    >
      {children}
    </SiteActionsContext.Provider>
  );
};

const toastStyle = {
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  backdropFilter: 'blur(12px)',
  fontSize: '0.875rem'
};

export const useSiteActions = () => useContext(SiteActionsContext);
