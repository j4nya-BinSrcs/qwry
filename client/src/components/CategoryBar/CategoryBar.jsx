import React from 'react';
import {
  LayoutGrid, Image as ImageIcon, Video, Newspaper, Bookmark, Link as LinkIcon, History as HistoryIcon, Settings, Sun, Moon
} from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { useTheme } from '../../context/ThemeContext';
import { motion } from 'framer-motion';
import './CategoryBar.css';

export const CategoryBar = () => {
  const { activeCategory, setActiveCategory } = useSearch();
  const { theme, cycleTheme } = useTheme();

  const categories = [
    { id: 'All', label: 'All', icon: LayoutGrid },
    { id: 'Images', label: 'Images', icon: ImageIcon },
    { id: 'Videos', label: 'Videos', icon: Video },
    { id: 'News', label: 'News', icon: Newspaper },
    { id: 'Saved', label: 'Saved', icon: Bookmark },
    { id: 'Links', label: 'Links', icon: LinkIcon },
    { id: 'History', label: 'History', icon: HistoryIcon },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  const renderThemeIcon = () => {
    return theme === 'dark' ? <Moon size={20} color="var(--accent-primary)" /> : <Sun size={20} color="var(--accent-primary)" />;
  };

  return (
    <aside className="category-sidebar-nav glass-panel">
      {/* Top Theme Cycle Button */}
      <button
        type="button"
        className="category-nav-item category-theme-btn"
        onClick={cycleTheme}
        title={`Current Theme: ${theme.toUpperCase()}. Click to switch.`}
      >
        {renderThemeIcon()}
        <span className="category-nav-label">Theme</span>
      </button>

      <div className="category-divider" />

      {/* Category Nav Items */}
      {categories.map((cat) => {
        const IconComponent = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <div
            key={cat.id}
            className={`category-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
          >
            {/* Sliding Active Left Border Indicator */}
            {isActive && (
              <motion.div
                layoutId="categoryActiveIndicator"
                className="category-active-bar"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <IconComponent size={20} className="category-nav-icon" />
            <span className="category-nav-label">{cat.label}</span>
          </div>
        );
      })}
    </aside>
  );
};
