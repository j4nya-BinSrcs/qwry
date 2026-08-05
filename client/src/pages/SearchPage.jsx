import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { SearchBar } from '../components/SearchBar/SearchBar';
import { SearchResults } from '../components/SearchResults/SearchResults';
import { AIChat } from '../components/AIChat/AIChat';
import { MediaPanel } from '../components/MediaPanel/MediaPanel';
import { CategoryBar } from '../components/CategoryBar/CategoryBar';
import { ProfileMenu } from '../components/Profile/ProfileMenu';
import { NetworkError } from '../components/ErrorStates/NetworkError';
import { Home, Search, Image as ImageIcon, Bookmark, Settings, History as HistoryIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import './SearchPage.css';

export const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { query, executeSearch, activeCategory, setActiveCategory, isOffline } = useSearch();

  const qParam = searchParams.get('q');
  const catParam = searchParams.get('category');

  // Sync URL query params with state
  useEffect(() => {
    if (qParam && qParam !== query) {
      executeSearch(qParam);
    } else if (!qParam && !query) {
      executeSearch('web design');
    }
  }, [qParam, executeSearch, query]);

  useEffect(() => {
    if (catParam) {
      const capitalized = catParam.charAt(0).toUpperCase() + catParam.slice(1);
      setActiveCategory(capitalized);
    }
  }, [catParam, setActiveCategory]);

  const handleSearchSubmit = (newQuery) => {
    setSearchParams({ q: newQuery, category: activeCategory.toLowerCase() });
    executeSearch(newQuery);
  };

  const handleTabChange = (catId) => {
    setActiveCategory(catId);
    setSearchParams({ q: query || 'web design', category: catId.toLowerCase() });
  };

  return (
    <div className="search-page-container">
      {/* Top Navigation Bar */}
      <header className="search-topbar">
        <motion.div
          className="topbar-logo-box"
          layoutId="qwryLogo"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <span className="logo-text topbar-logo-text">Qwry</span>
        </motion.div>

        <motion.div className="topbar-search-wrapper" layoutId="qwrySearchBar">
          <SearchBar variant="topbar" onSearchSubmit={handleSearchSubmit} />
        </motion.div>

        <div className="topbar-profile-box">
          <ProfileMenu />
        </div>
      </header>

      {/* Main Layout Area */}
      {isOffline ? (
        <NetworkError />
      ) : (
        <main className="search-content-grid">
          {/* Zone 1: Website Links Panel */}
          <div className={`grid-zone zone-links ${activeCategory !== 'All' && activeCategory !== 'Links' ? 'mobile-hide' : ''}`}>
            <SearchResults />
          </div>

          {/* Zone 2: AI Overview + Chat Panel */}
          <div className={`grid-zone zone-ai ${activeCategory !== 'All' && activeCategory !== 'AI Chat' ? 'mobile-hide' : ''}`}>
            <AIChat />
          </div>

          {/* Zone 3: Media & Category Detail Panel */}
          <div className={`grid-zone zone-media ${activeCategory === 'All' || activeCategory === 'Links' || activeCategory === 'AI Chat' ? 'mobile-hide' : ''}`}>
            <MediaPanel />
          </div>

          {/* Zone 4: Category Bar (Desktop / Tablet Sidebar) */}
          <div className="grid-zone zone-sidebar">
            <CategoryBar />
          </div>

          {/* Single Clean Mobile Bottom Navigation Bar */}
          <nav className="mobile-bottom-nav">
            <button className="mobile-nav-btn" onClick={() => navigate('/')}>
              <Home size={20} />
              <span>Home</span>
            </button>

            <button className={`mobile-nav-btn ${activeCategory === 'All' ? 'active' : ''}`} onClick={() => handleTabChange('All')}>
              <Search size={20} />
              <span>Search</span>
            </button>

            <button className={`mobile-nav-btn ${activeCategory === 'Images' ? 'active' : ''}`} onClick={() => handleTabChange('Images')}>
              <ImageIcon size={20} />
              <span>Images</span>
            </button>

            <button className={`mobile-nav-btn ${activeCategory === 'Saved' ? 'active' : ''}`} onClick={() => handleTabChange('Saved')}>
              <Bookmark size={20} />
              <span>Saved</span>
            </button>

            <button className={`mobile-nav-btn ${activeCategory === 'History' ? 'active' : ''}`} onClick={() => handleTabChange('History')}>
              <HistoryIcon size={20} />
              <span>History</span>
            </button>

            <button className={`mobile-nav-btn ${activeCategory === 'Settings' ? 'active' : ''}`} onClick={() => handleTabChange('Settings')}>
              <Settings size={20} />
              <span>Profile</span>
            </button>
          </nav>
        </main>
      )}
    </div>
  );
};
