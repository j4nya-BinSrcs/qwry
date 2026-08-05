import React from 'react';
import { useSiteActions } from '../../context/SiteActionsContext';
import { motion, AnimatePresence } from 'framer-motion';

export const PinnedSites = () => {
  const { pinnedSites, togglePin } = useSiteActions();

  if (!pinnedSites || pinnedSites.length === 0) return null;

  return (
    <div className="pinned-sites-container">
      <div className="pinned-sites-title font-heading">
        <span>Pinned Sites</span>
        <span className="pinned-count">{pinnedSites.length}/10</span>
      </div>
      <div className="pinned-sites-row">
        <AnimatePresence>
          {pinnedSites.map((site) => (
            <motion.div
              key={site.id || site.url}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pinned-site-card"
              title={`${site.title || site.domain} (Click to open, right click/hover to unpin)`}
              onClick={() => window.open(site.url, '_blank')}
            >
              <img
                src={site.favicon || `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`}
                alt=""
                className="pinned-site-icon"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <button
                type="button"
                className="pinned-unpin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(site);
                }}
                title="Unpin"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
