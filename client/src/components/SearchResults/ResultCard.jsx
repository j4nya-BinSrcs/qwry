import React, { useState } from 'react';
import { Pin, Ban, Bookmark, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { useSiteActions } from '../../context/SiteActionsContext';
import { ContextMenu } from './ContextMenu';

export const ResultCard = ({ item, index }) => {
  const { pinnedSites, togglePin, blacklistSite, bookmarks, toggleBookmark } = useSiteActions();
  const [contextMenuPos, setContextMenuPos] = useState(null);

  const isPinned = pinnedSites.some(p => p.id === item.id || p.url === item.url);
  const isBookmarked = bookmarks.some(b => b.id === item.id || b.url === item.url);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `result-${item.id}`,
    data: { ...item, type: 'result' }
  });

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  let domain = item.domain;
  if (!domain && item.url) {
    try { domain = new URL(item.url).hostname; } catch { domain = item.url; }
  }

  return (
    <>
      <motion.div
        ref={setNodeRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, height: 0 }}
        transition={{ duration: 0.25, delay: index * 0.04 }}
        className="result-card-container"
        onContextMenu={handleContextMenu}
      >
        <div className="result-card-inner">
          {/* Drag handle */}
          <div className="result-drag-handle" {...attributes} {...listeners} title="Drag to AI Chat">
            <GripVertical size={16} />
          </div>

          <div className="result-card-content">
            {/* Row 1: Favicon + Domain */}
            <div className="result-card-header">
              <img
                src={item.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                alt=""
                className="result-favicon"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <span className="result-domain">{domain || item.url}</span>

              {/* Action Icons (Hover Top-Right) */}
              <div className="result-actions-overlay">
                <button
                  type="button"
                  className={`result-action-btn ${isPinned ? 'active-pin' : ''}`}
                  onClick={(e) => { e.stopPropagation(); togglePin(item); }}
                  title={isPinned ? 'Unpin site' : 'Pin site'}
                >
                  <Pin size={14} fill={isPinned ? 'var(--accent-primary)' : 'none'} />
                </button>

                <button
                  type="button"
                  className={`result-action-btn ${isBookmarked ? 'active-bookmark' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(item); }}
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark page'}
                >
                  <Bookmark size={14} fill={isBookmarked ? 'var(--accent-secondary)' : 'none'} />
                </button>

                <button
                  type="button"
                  className="result-action-btn action-blacklist"
                  onClick={(e) => { e.stopPropagation(); blacklistSite(item); }}
                  title="Block domain"
                >
                  <Ban size={14} />
                </button>
              </div>
            </div>

            {/* Row 2: Title */}
            <h3 className="result-card-title">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {item.title}
              </a>
            </h3>

            {/* Row 3: Snippet */}
            <p className="result-card-snippet">{item.snippet}</p>
          </div>
        </div>
      </motion.div>

      {/* Right-click Context Menu */}
      <AnimatePresence>
        {contextMenuPos && (
          <ContextMenu
            x={contextMenuPos.x}
            y={contextMenuPos.y}
            item={item}
            onClose={() => setContextMenuPos(null)}
            onPin={togglePin}
            onBlacklist={blacklistSite}
            onBookmark={toggleBookmark}
          />
        )}
      </AnimatePresence>
    </>
  );
};
