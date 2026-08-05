import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Lightbox = ({ image, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!image) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(16px)',
          zIndex: 'var(--z-modal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 10,
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>

          <img
            src={image.src}
            alt={image.alt || image.title}
            style={{
              maxWidth: '100%',
              maxHeight: '75vh',
              objectFit: 'contain',
              display: 'block'
            }}
          />

          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {image.title || 'Image Preview'}
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {image.alt}
              </p>
            </div>
            <a
              href={image.src}
              target="_blank"
              rel="noopener noreferrer"
              className="pill"
            >
              Full Resolution <ExternalLink size={12} />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
