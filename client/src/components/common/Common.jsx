import React from 'react';

export const GlassPanel = ({ children, className = '', style = {}, onClick }) => {
  return (
    <div className={`glass-panel ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
};

export const Pill = ({ children, onClick, active = false, hasDot = false, className = '', style = {} }) => {
  return (
    <button
      onClick={onClick}
      className={`pill ${active ? 'pill-active' : ''} ${className}`}
      style={{
        borderColor: active ? 'var(--accent-primary)' : undefined,
        color: active ? 'var(--text-primary)' : undefined,
        background: active ? 'var(--accent-primary-subtle)' : undefined,
        ...style
      }}
    >
      {hasDot && <span className="pill-dot" />}
      {children}
    </button>
  );
};

export const SkeletonLoader = ({ count = 3, height = '80px', className = '' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer-skeleton" style={{ height, width: '100%' }} />
      ))}
    </div>
  );
};
