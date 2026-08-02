import React, { useEffect, useRef } from 'react';
import { Pin, Ban, Bookmark, Copy, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export const ContextMenu = ({ x, y, item, onClose, onPin, onBlacklist, onBookmark }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(item.url);
    toast.success('📋 URL copied to clipboard');
    onClose();
  };

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9, y: -5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed',
        top: y,
        left: Math.min(x, window.innerWidth - 200),
        zIndex: 'var(--z-modal)',
        minWidth: '190px',
        backgroundColor: 'var(--bg-elevated)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}
    >
      <div
        className="context-menu-item"
        onClick={() => { onPin(item); onClose(); }}
      >
        <Pin size={15} /> <span>📌 Pin this site</span>
      </div>

      <div
        className="context-menu-item"
        onClick={() => { onBlacklist(item); onClose(); }}
      >
        <Ban size={15} color="var(--error)" /> <span style={{ color: 'var(--error)' }}>🚫 Block this domain</span>
      </div>

      <div
        className="context-menu-item"
        onClick={() => { onBookmark(item); onClose(); }}
      >
        <Bookmark size={15} /> <span>🔖 Bookmark page</span>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

      <div className="context-menu-item" onClick={handleCopyUrl}>
        <Copy size={15} /> <span>📋 Copy URL</span>
      </div>

      <div
        className="context-menu-item"
        onClick={() => {
          window.open(item.url, '_blank');
          onClose();
        }}
      >
        <ExternalLink size={15} /> <span>Open link</span>
      </div>
    </motion.div>
  );
};
