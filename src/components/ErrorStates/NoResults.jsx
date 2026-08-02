import React from 'react';
import { Pill } from '../common/Common';
import { useSearch } from '../../context/SearchContext';
import { motion } from 'framer-motion';

export const NoResults = ({ query }) => {
  const { executeSearch } = useSearch();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--text-secondary)'
      }}
    >
      {/* Animated Cute Ghost/Robot SVG Illustration */}
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ marginBottom: '16px' }}>
        <g style={{ animation: 'aurora-drift-1 10s infinite ease-in-out' }}>
          <path
            d="M30 50 C30 25, 90 25, 90 50 V90 Q75 80, 60 90 Q45 100, 30 90 Z"
            fill="var(--glass-bg-hover)"
            stroke="var(--accent-primary)"
            strokeWidth="2.5"
          />
          <circle cx="48" cy="52" r="5" fill="var(--accent-primary)" />
          <circle cx="72" cy="52" r="5" fill="var(--accent-primary)" />
          <path d="M52 68 Q60 74, 68 68" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        {/* Floating Question Marks */}
        <text x="20" y="30" fill="var(--accent-secondary)" fontSize="20" fontWeight="bold">?</text>
        <text x="95" y="40" fill="var(--accent-tertiary)" fontSize="16" fontWeight="bold">?</text>
      </svg>

      <h3 className="font-heading" style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
        Nothing found for "{query || 'your search'}"
      </h3>
      <p style={{ fontSize: 'var(--text-sm)', maxWidth: '340px', marginBottom: '20px' }}>
        Try tweaking your search keywords, checking for typos, or choosing from recommended topics below.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {['web design trends', 'react docs', 'glassmorphism css'].map(term => (
          <Pill key={term} onClick={() => executeSearch(term)}>
            🔍 {term}
          </Pill>
        ))}
      </div>
    </motion.div>
  );
};
