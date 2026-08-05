import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, History as HistoryIcon, Bookmark, Sun, Moon, Copy, Check, ChevronDown } from 'lucide-react';
import { getProfile } from '../../api/profile';
import { useSessionStore } from '../../stores/sessionStore';
import { useSearch } from '../../context/SearchContext';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './ProfileMenu.css';

export const ProfileMenu = ({ onOpenSettingsModal }) => {
  const navigate = useNavigate();
  const sessionId = useSessionStore((state) => state.sessionId);
  const { query, setActiveCategory } = useSearch();
  const { theme, cycleTheme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      const data = await getProfile();
      if (isMounted && data) {
        setProfile(data);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Close dropdown on outside click or scroll
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNavigateCategory = (categoryName) => {
    setIsOpen(false);
    if (onOpenSettingsModal) {
      onOpenSettingsModal(categoryName.toLowerCase());
      return;
    }
    setActiveCategory(categoryName);
    const targetUrl = query
      ? `/search?q=${encodeURIComponent(query)}&category=${categoryName.toLowerCase()}`
      : `/search?category=${categoryName.toLowerCase()}`;
    navigate(targetUrl);
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    setCopied(true);
    toast.success('Session ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const username = profile?.username || 'User';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="profile-menu-wrapper" ref={menuRef}>
      {/* Avatar Button */}
      <button
        type="button"
        className="profile-avatar-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User Account Profile Menu"
      >
        <div className="profile-avatar-circle">
          {initial || <User size={16} />}
          <span className="profile-status-dot" />
        </div>
        <span className="profile-avatar-name">{username}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="profile-dropdown-menu"
          >
            {/* Header */}
            <div className="dropdown-header">
              <div className="dropdown-avatar-circle">{initial}</div>
              <div className="dropdown-user-info">
                <span className="dropdown-user-name">{username}</span>
                <span className="dropdown-user-session">ID: {sessionId.slice(0, 8)}...</span>
              </div>
            </div>

            <div className="dropdown-divider" />

            {/* Menu Options */}
            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleNavigateCategory('Settings')}
            >
              <Settings size={15} className="dropdown-item-icon" />
              <span>Profile & Settings</span>
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleNavigateCategory('History')}
            >
              <HistoryIcon size={15} className="dropdown-item-icon" />
              <span>Search & Activity History</span>
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={() => handleNavigateCategory('Saved')}
            >
              <Bookmark size={15} className="dropdown-item-icon" />
              <span>Saved Bookmarks</span>
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={cycleTheme}
            >
              {theme === 'dark' ? <Moon size={15} className="dropdown-item-icon" /> : <Sun size={15} className="dropdown-item-icon" />}
              <span>Switch Theme ({theme === 'dark' ? 'Dark' : 'Light'})</span>
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={copySessionId}
            >
              {copied ? <Check size={15} className="dropdown-item-icon" /> : <Copy size={15} className="dropdown-item-icon" />}
              <span>Copy Session ID</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
