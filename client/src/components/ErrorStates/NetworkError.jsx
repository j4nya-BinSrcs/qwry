import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Pill } from '../common/Common';
import { useSearch } from '../../context/SearchContext';
import { motion } from 'framer-motion';

export const NetworkError = () => {
  const { setIsOffline, executeSearch, query } = useSearch();

  const handleRetry = () => {
    setIsOffline(false);
    executeSearch(query || 'web design');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 20px',
        color: 'var(--text-secondary)'
      }}
    >
      <div style={{ padding: '20px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', marginBottom: '16px' }}>
        <WifiOff size={48} color="var(--error)" />
      </div>

      <h3 className="font-heading" style={{ fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
        You're Offline
      </h3>
      <p style={{ fontSize: 'var(--text-sm)', maxWidth: '360px', marginBottom: '24px' }}>
        Qwry needs the internet to explore the cosmos. Check your connection or turn off simulated offline mode.
      </p>

      <Pill onClick={handleRetry} style={{ borderColor: 'var(--accent-primary)', padding: '10px 20px' }}>
        <RefreshCw size={16} /> Reconnect & Retry
      </Pill>
    </motion.div>
  );
};
