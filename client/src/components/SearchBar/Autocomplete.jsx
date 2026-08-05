import React from 'react';
import { Search, Clock, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

export const Autocomplete = ({ suggestions, selectedIndex, onSelectSuggestion }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: '8px',
        background: 'var(--bg-elevated)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 'var(--z-overlay)',
        overflow: 'hidden',
        maxHeight: '320px',
        overflowY: 'auto'
      }}
    >
      {suggestions.map((item, index) => {
        const text = typeof item === 'string' ? item : item.text;
        const type = typeof item === 'object' ? item.type : 'suggested';
        const isSelected = index === selectedIndex;

        return (
          <div
            key={index}
            onClick={() => onSelectSuggestion(text)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 16px',
              fontSize: 'var(--text-sm)',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
              borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 120ms ease'
            }}
          >
            {type === 'recent' && <Clock size={16} color="var(--text-tertiary)" />}
            {type === 'trending' && <Flame size={16} color="var(--accent-primary)" />}
            {type === 'suggested' && <Search size={16} color="var(--text-tertiary)" />}
            <span style={{ flex: 1 }}>{text}</span>
          </div>
        );
      })}
    </motion.div>
  );
};
