import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar/SearchBar';
import { Pill } from '../components/common/Common';
import { BorderGlow } from '../components/common/BorderGlow';
import { useSearch } from '../context/SearchContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import './LandingPage.css';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { executeSearch, setActiveCategory } = useSearch();
  const { theme, cycleTheme } = useTheme();

  const handleLandingSearch = (queryText) => {
    executeSearch(queryText);
    navigate(`/search?q=${encodeURIComponent(queryText)}`);
  };

  const quickPills = [
    { label: 'Web design', query: 'web design', hasDot: true },
    { label: 'React docs', query: 'react docs', hasDot: false },
    { label: 'Glassmorphism', query: 'glassmorphism css', hasDot: true },
    { label: 'Framer Motion', query: 'framer motion', hasDot: false },
  ];

  return (
    <div className="landing-page-container">
      {/* Background — Aurora Mesh Blobs */}
      <div className="aurora-mesh-overlay">
        <div className="aurora-blob blob-amber" />
        <div className="aurora-blob blob-teal" />
        <div className="aurora-blob blob-violet" />
        <div className="aurora-blob blob-rose" />
      </div>

      {/* Main Centered Content */}
      <motion.main
        className="landing-main-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo with Gradient Shift & Stagger Entrance */}
        <motion.div className="landing-logo-box" layoutId="qwryLogo">
          <h1 className="logo-text landing-logo-text">Qwry</h1>
        </motion.div>

        {/* Search Bar wrapped with Interactive BorderGlow */}
        <motion.div className="landing-search-wrapper" layoutId="qwrySearchBar">
          <BorderGlow
            className="landing-border-glow-container"
            glowColor="268 100 76"
            backgroundColor="transparent"
            borderRadius={28}
            glowRadius={40}
            glowIntensity={1.2}
            colors={['#8b5cf6', '#ec4899', '#06b6d4']}
          >
            <SearchBar variant="landing" onSearchSubmit={handleLandingSearch} />
          </BorderGlow>
        </motion.div>

        {/* Quick Pills */}
        <div className="landing-pills-row">
          <Pill
            onClick={cycleTheme}
            style={{ borderColor: 'var(--accent-primary-glow)' }}
          >
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            <span>Theme ({theme})</span>
          </Pill>

          {quickPills.map(p => (
            <Pill
              key={p.label}
              hasDot={p.hasDot}
              onClick={() => handleLandingSearch(p.query)}
            >
              {p.label}
            </Pill>
          ))}
        </div>
      </motion.main>

      {/* Bottom Corner Controls */}
      <div className="landing-bottom-controls">
        <button
          type="button"
          className="pill"
          onClick={() => {
            setActiveCategory('Settings');
            navigate('/search?category=settings');
          }}
        >
          <Settings size={14} /> Settings
        </button>
      </div>
    </div>
  );
};
