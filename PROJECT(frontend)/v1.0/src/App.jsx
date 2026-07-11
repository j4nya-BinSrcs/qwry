import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Dummy data for initial results
const initialResults = [
  { id: 1, url: 'https://example.com/modern-design-1', title: 'Top Web Design Trends 2026', desc: 'Explore the most creative and modern web designs. Learn how to implement glassmorphism, fluid animations, and dark mode effectively.', logo: '🌐', previewImg: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=400&q=80' },
  { id: 2, url: 'https://react.dev/learn', title: 'React Documentation', desc: 'The library for web and native user interfaces.', logo: '⚛️', previewImg: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80' },
  { id: 3, url: 'https://vitejs.dev/guide/', title: 'Vite Next Generation Frontend Tooling', desc: 'Get ready for a development environment that can finally catch up with you.', logo: '⚡', previewImg: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80' },
  { id: 4, url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', title: 'CSS: Cascading Style Sheets | MDN', desc: 'CSS is the language we use to style an HTML document.', logo: 'Ⓜ️', previewImg: 'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?w=400&q=80' },
  { id: 5, url: 'https://dribbble.com/tags/glassmorphism', title: 'Glassmorphism designs - Dribbble', desc: 'Discover 1000+ Glassmorphism designs on Dribbble.', logo: '🏀', previewImg: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?w=400&q=80' },
];

const mockImages = [
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=400&q=80",
];

const mockVideos = [
  "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80",
];

export default function App() {
  const [view, setView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState('dark');
  const [isOffline, setIsOffline] = useState(false);
  
  // Interactive State
  const [activeMediaTab, setActiveMediaTab] = useState('All');
  const [pinnedSites, setPinnedSites] = useState([]);
  const [blacklistedSites, setBlacklistedSites] = useState([]);
  const [explodingItems, setExplodingItems] = useState([]);
  const [chatAttachments, setChatAttachments] = useState([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [searchHistory, setSearchHistory] = useState(['web design', 'react docs', 'glassmorphism']);
  
  const sidebarTabs = ['All', 'Images', 'Videos', 'Saved', 'Links', 'History', 'Settings'];
  
  // Hover Preview State
  const [hoveredItem, setHoveredItem] = useState(null);
  const hoverTimeoutRef = useRef(null);

  // Custom Drag Ghost State
  const [dragItem, setDragItem] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const emptyImageRef = useRef(new Image());

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Global mouse tracker for Custom Drag Ghost
  useEffect(() => {
    const handleDragOver = (e) => {
      setDragPos({ x: e.clientX, y: e.clientY });
    };
    const handleDragEnd = () => {
      setDragItem(null);
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() !== '') {
      setView('results');
      if (!searchHistory.includes(searchQuery.trim())) {
        setSearchHistory(prev => [searchQuery.trim(), ...prev.slice(0, 9)]);
      }
    }
  };

  const handleDragStart = (e, data) => {
    // Hide default native drag image
    e.dataTransfer.setDragImage(emptyImageRef.current, 0, 0);
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    // Trigger our custom ghost
    setDragItem(data);
    setHoveredItem(null); // Force hide preview while dragging
    clearTimeout(hoverTimeoutRef.current);
  };

  const handleDropToChat = (e) => {
    e.preventDefault();
    setIsDraggingOverChat(false);
    setDragItem(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (!chatAttachments.find(a => a.id === data.id || a.src === data.src)) {
        setChatAttachments([...chatAttachments, data]);
      }
    } catch (err) {
      console.error("Drop failed", err);
    }
  };

  const togglePin = (site) => {
    if (pinnedSites.find(p => p.id === site.id)) {
      setPinnedSites(pinnedSites.filter(p => p.id !== site.id));
    } else {
      setPinnedSites([...pinnedSites, site]);
    }
  };

  const handleBlacklist = (siteId) => {
    if (!explodingItems.includes(siteId)) {
      setHoveredItem(null); // Hide preview when blowing up
      setExplodingItems([...explodingItems, siteId]);
      // Wait for blast animation
      setTimeout(() => {
        setBlacklistedSites(prev => [...prev, siteId]);
        setExplodingItems(prev => prev.filter(id => id !== siteId));
      }, 700);
    }
  };

  const filteredResults = initialResults.filter(
    r => !blacklistedSites.includes(r.id) && r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Hover Preview Handlers
  const handleMouseEnter = (e, item) => {
    // Only trigger if we aren't dragging something
    if (dragItem) return;
    const { clientX, clientY } = e;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItem({ ...item, x: clientX, y: clientY });
    }, 600);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredItem(null);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  // -------- HOME VIEW --------
  if (view === 'home') {
    return (
      <div className="app-container home-view-container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="home-content">
          <h1 className="home-logo">Qwry</h1>
          <form className="home-search-form" onSubmit={handleSearchSubmit}>
            <svg className="search-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className="search-input home-search-input" 
              placeholder="Search anything..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </form>
          <div className="home-suggestions">
            <button onClick={toggleTheme} className="pill">{theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
            <button onClick={() => setIsOffline(!isOffline)} className="pill" style={{ borderColor: isOffline ? 'red' : '' }}>{isOffline ? '🔴 Go Online' : '🟢 Simulate Offline'}</button>
            <span className="pill" onClick={() => { setSearchQuery('Web design'); setView('results'); }}>Web design</span>
            <span className="pill" onClick={() => { setSearchQuery('React docs'); setView('results'); }}>React docs</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // -------- RESULTS VIEW --------
  return (
    <div className="app-container">
      
      {/* Custom Drag Ghost Layer */}
      {dragItem && (
        <motion.div 
          className="custom-drag-ghost"
          style={{
            position: 'fixed',
            top: dragPos.y - 35,
            left: dragPos.x - 35,
            pointerEvents: 'none',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1.1, 
            opacity: 0.95,
            y: [0, -10, 0],
            rotate: [-4, 4, -4]
          }}
          transition={{
            scale: { duration: 0.15 },
            opacity: { duration: 0.15 },
            y: { repeat: Infinity, duration: 1.0, ease: "easeInOut" },
            rotate: { repeat: Infinity, duration: 1.0, ease: "easeInOut" }
          }}
        >
          {/* Cute Ghost SVG - Only the ghost is shown */}
          <svg width="70" height="70" viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0px 8px 20px rgba(88, 166, 255, 0.75))' }}>
            <path 
              d="M 20 45 
                 A 30 30 0 0 1 80 45 
                 V 75 
                 Q 72.5 70, 65 75 
                 Q 57.5 80, 50 75 
                 Q 42.5 70, 35 75 
                 Q 27.5 80, 20 75 
                 Z" 
              fill="var(--accent-color)" 
              stroke="white" 
              strokeWidth="3.5"
            />
            <circle cx="40" cy="42" r="5" fill="var(--bg-color)" />
            <circle cx="60" cy="42" r="5" fill="var(--bg-color)" />
            <circle cx="32" cy="48" r="3" fill="#ff8da1" opacity="0.85" />
            <circle cx="68" cy="48" r="3" fill="#ff8da1" opacity="0.85" />
            <path d="M 46 48 Q 50 52, 54 48" fill="none" stroke="var(--bg-color)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 15 50 C 8 50, 8 56, 17 54" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <path d="M 85 50 C 92 50, 92 56, 83 54" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </motion.div>
      )}

      {/* Hover Preview Portal */}
      <AnimatePresence>
        {hoveredItem && !dragItem && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="hover-preview-modal"
            style={{ top: hoveredItem.y + 20, left: hoveredItem.x + 20 }}
          >
            {hoveredItem.type === 'link' ? (
              <>
                <img src={hoveredItem.previewImg} className="preview-image" alt="preview" />
                <div className="preview-title">{hoveredItem.title}</div>
                <div className="preview-desc">{hoveredItem.desc}</div>
              </>
            ) : (
              <img src={hoveredItem.src} className="preview-image" alt="preview" style={{height: '250px'}} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="header">
        <div className="logo cursor-pointer" onClick={() => setView('home')}>Qwry</div>
        <form className="search-bar-container" onSubmit={handleSearchSubmit}>
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" className="search-input" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </form>
      </header>

      <main className="main-content">
        
        {/* Column 1: Website Links */}
        <section className="column glass-panel">
          <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg> Website Links</h2>
          <div className="scrollable-area" onMouseLeave={handleMouseLeave}>
            {isOffline ? (
              <div className="empty-state">
                <div className="empty-icon">📡</div>
                <h3>Network Offline</h3>
                <p>Please check your internet connection.</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No results found</h3>
                <p>Try tweaking your search query.</p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredResults.map((item) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, scale: 0.5, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="result-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(item.url, '_blank')}
                    draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'link', ...item })}
                    onMouseEnter={(e) => handleMouseEnter(e, { type: 'link', ...item })}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Ghost Blast Animation */}
                    <AnimatePresence>
                      {explodingItems.includes(item.id) && (
                        <motion.div 
                          initial={{ scale: 0.3, opacity: 0, rotate: -15 }} 
                          animate={{ 
                            scale: [0.3, 1.3, 1.5], 
                            opacity: [0, 1, 1, 0], 
                            rotate: [-15, 15, -10] 
                          }} 
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                          style={{ 
                            position: 'absolute', 
                            top: '50%', 
                            left: '50%', 
                            x: '-50%',
                            y: '-50%',
                            zIndex: 10, 
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {/* Spark / blast circle */}
                          <svg width="60" height="60" viewBox="0 0 100 100" style={{ position: 'absolute' }}>
                            <circle cx="50" cy="50" r="35" fill="none" stroke="#ff4757" strokeWidth="3" strokeDasharray="8 4" />
                            <path d="M 50 15 L 50 5 M 50 85 L 50 95 M 15 50 L 5 50 M 85 50 L 95 50 M 25 25 L 17 17 M 75 75 L 83 83 M 25 75 L 17 83 M 75 25 L 83 17" stroke="#ff4757" strokeWidth="3.5" strokeLinecap="round" />
                          </svg>
                          
                          {/* Popping Ghost */}
                          <svg width="42" height="42" viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0px 4px 10px rgba(255, 71, 87, 0.5))' }}>
                            <path 
                              d="M 20 45 
                                 A 30 30 0 0 1 80 45 
                                 V 75 
                                 Q 72.5 70, 65 75 
                                 Q 57.5 80, 50 75 
                                 Q 42.5 70, 35 75 
                                 Q 27.5 80, 20 75 
                                 Z" 
                              fill="#ff4757" 
                              stroke="white" 
                              strokeWidth="3"
                            />
                            {/* X eyes */}
                            <path d="M 36 40 L 44 48 M 44 40 L 36 48" stroke="white" strokeWidth="3" strokeLinecap="round" />
                            <path d="M 56 40 L 64 48 M 64 40 L 56 48" stroke="white" strokeWidth="3" strokeLinecap="round" />
                            {/* Shocked open mouth */}
                            <circle cx="50" cy="58" r="5" fill="white" />
                          </svg>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={{ opacity: explodingItems.includes(item.id) ? 0 : 1, transition: 'opacity 0.2s' }}>
                      <div className="result-header">
                        <div className="result-url">{item.url}</div>
                        <div className="result-actions">
                          <button onClick={(e) => { e.stopPropagation(); togglePin(item); }} className={pinnedSites.find(p=>p.id===item.id) ? 'active-icon' : ''} title="Pin Site">📌</button>
                          <button onClick={(e) => { e.stopPropagation(); handleBlacklist(item.id); }} title="Blacklist Site">🚫</button>
                        </div>
                      </div>
                      <div className="result-title">{item.title}</div>
                      <div className="result-desc">{item.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Column 2: AI Summary + Search Related */}
        <section className="column">
          <div 
            className={`glass-panel ai-box ${isDraggingOverChat ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingOverChat(true); }}
            onDragLeave={() => setIsDraggingOverChat(false)}
            onDrop={handleDropToChat}
          >
            <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 1 1 12 2Z"></path></svg> AI Overview</h2>
            <div className="ai-content">
              Modern web design focuses on immersive experiences. Try dragging the results on the left into this chat box to add context!
            </div>
            {chatAttachments.length > 0 && (
              <div className="chat-attachments">
                <AnimatePresence>
                  {chatAttachments.map((att, idx) => (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} key={idx} className="attachment-pill">
                      {att.type === 'link' ? `🔗 ${att.title}` : '🖼️ Image'}
                      <span className="remove-att" onClick={() => setChatAttachments(chatAttachments.filter((_, i) => i !== idx))}>&times;</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <input type="text" className="ai-chat-input" placeholder="Ask a follow up... (drop here)" />
            {isDraggingOverChat && <div className="drop-overlay">Drop to feed AI 👻</div>}
          </div>

          <div className="glass-panel search-related">
            <h2><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8M3 16.2V21m0 0h4.8M3 21l6-6M3 7.8V3m0 0h4.8M3 3l6 6m12-1.2V3m0 0h-4.8M21 3l-6 6"></path></svg> Related & Improve</h2>
            <div>
              {['glassmorphism css', 'dark mode palette', 'react animations'].map(p => (
                <span key={p} className="pill" onClick={() => setSearchQuery(p)}>{p}</span>
              ))}
            </div>
            {pinnedSites.length > 0 && (
              <div className="pinned-sites-section">
                <h3 className="section-subtitle">Pinned Sites</h3>
                <div className="pinned-logos">
                  <AnimatePresence>
                    {pinnedSites.map(site => (
                      <motion.div initial={{scale:0}} animate={{scale:1}} exit={{scale:0}} key={site.id} className="pinned-logo" title={site.title} onClick={() => togglePin(site)}>
                        {site.logo}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Column 3: Photo/Video */}
        <section className="column glass-panel">
          <h2>
            {activeMediaTab === 'All' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>}
            {activeMediaTab === 'Images' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>}
            {activeMediaTab === 'Videos' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>}
            {activeMediaTab === 'Saved' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>}
            {activeMediaTab === 'Links' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>}
            {activeMediaTab === 'History' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>}
            {activeMediaTab === 'Settings' && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>}
            {` ${activeMediaTab}`}
          </h2>
          
          <div className="scrollable-area" onMouseLeave={handleMouseLeave}>
            {isOffline ? (
              <div className="empty-state"><div className="empty-icon">🔌</div><h3>Network Offline</h3></div>
            ) : (
              <AnimatePresence mode="wait">
                {activeMediaTab === 'All' && (
                  <motion.div key="all-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🖼️ Images <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({mockImages.length} total, showing 4)</span>
                      </h3>
                      <div className="image-grid">
                        {mockImages.slice(0, 4).map((src, idx) => (
                          <motion.div key={`all-img-${idx}`} initial={{opacity:0}} animate={{opacity:1}}
                            className="image-card" style={{ backgroundImage: `url(${src})` }}
                            draggable 
                            onDragStart={(e) => handleDragStart(e, { type: 'image', src })}
                            onMouseEnter={(e) => handleMouseEnter(e, { type: 'image', src })} 
                            onMouseLeave={handleMouseLeave}
                          />
                        ))}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '15px' }}>
                      <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🎬 Videos <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({mockVideos.length} total, showing 4)</span>
                      </h3>
                      <div className="image-grid">
                        {mockVideos.slice(0, 4).map((src, idx) => (
                          <motion.div key={`all-vid-${idx}`} initial={{opacity:0}} animate={{opacity:1}}
                            className="image-card video-card" style={{ backgroundImage: `url(${src})` }}
                            draggable 
                            onDragStart={(e) => handleDragStart(e, { type: 'image', src })}
                            onMouseEnter={(e) => handleMouseEnter(e, { type: 'image', src })} 
                            onMouseLeave={handleMouseLeave}
                          >
                            <div className="play-icon">▶</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeMediaTab === 'Images' && (
                  <motion.div key="images-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="image-grid">
                    {mockImages.map((src, idx) => (
                      <motion.div key={`img-${idx}`} initial={{opacity:0}} animate={{opacity:1}}
                        className="image-card" style={{ backgroundImage: `url(${src})` }}
                        draggable 
                        onDragStart={(e) => handleDragStart(e, { type: 'image', src })}
                        onMouseEnter={(e) => handleMouseEnter(e, { type: 'image', src })} 
                        onMouseLeave={handleMouseLeave}
                      />
                    ))}
                  </motion.div>
                )}

                {activeMediaTab === 'Videos' && (
                  <motion.div key="videos-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="image-grid">
                    {mockVideos.map((src, idx) => (
                      <motion.div key={`vid-${idx}`} initial={{opacity:0}} animate={{opacity:1}}
                        className="image-card video-card" style={{ backgroundImage: `url(${src})` }}
                        draggable 
                        onDragStart={(e) => handleDragStart(e, { type: 'image', src })}
                        onMouseEnter={(e) => handleMouseEnter(e, { type: 'image', src })} 
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="play-icon">▶</div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {activeMediaTab === 'Saved' && (
                  <motion.div key="saved-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pinnedSites.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">📌</div>
                        <p style={{ fontSize: '0.9rem' }}>No pinned sites yet.</p>
                        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>Pin sites from search results to see them here.</p>
                      </div>
                    ) : (
                      pinnedSites.map(site => (
                        <div 
                          key={`saved-${site.id}`} 
                          className="result-card"
                          style={{ margin: 0, cursor: 'pointer' }}
                          onClick={() => window.open(site.url, '_blank')}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { type: 'link', ...site })}
                          onMouseEnter={(e) => handleMouseEnter(e, { type: 'link', ...site })}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="result-header">
                            <span style={{ fontSize: '1.2rem' }}>{site.logo}</span>
                            <button onClick={(e) => { e.stopPropagation(); togglePin(site); }} className="active-icon" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>📌</button>
                          </div>
                          <div className="result-title" style={{ fontSize: '0.95rem', marginTop: '4px' }}>{site.title}</div>
                          <div className="result-url" style={{ fontSize: '0.75rem', marginBottom: 0 }}>{site.url}</div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {activeMediaTab === 'Links' && (
                  <motion.div key="links-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredResults.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">🔗</div>
                        <p>No links found.</p>
                      </div>
                    ) : (
                      filteredResults.map(item => (
                        <div 
                          key={`links-${item.id}`} 
                          className="result-card" 
                          style={{ margin: 0, cursor: 'pointer' }}
                          onClick={() => window.open(item.url, '_blank')}
                          draggable
                          onDragStart={(e) => handleDragStart(e, { type: 'link', ...item })}
                          onMouseEnter={(e) => handleMouseEnter(e, { type: 'link', ...item })}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="result-header">
                            <span style={{ fontSize: '1.1rem' }}>{item.logo}</span>
                            <div className="result-actions">
                              <button onClick={(e) => { e.stopPropagation(); togglePin(item); }} className={pinnedSites.find(p=>p.id===item.id) ? 'active-icon' : ''} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>📌</button>
                            </div>
                          </div>
                          <div className="result-title" style={{ fontSize: '0.95rem', marginTop: '4px' }}>{item.title}</div>
                          <div className="result-url" style={{ fontSize: '0.75rem', marginBottom: 0 }}>{item.url}</div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {activeMediaTab === 'History' && (
                  <motion.div key="history-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {searchHistory.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-icon">⏳</div>
                        <p>No search history yet.</p>
                      </div>
                    ) : (
                      searchHistory.map((query, index) => (
                        <div 
                          key={index} 
                          className="pill" 
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '10px 16px' }}
                          onClick={() => { setSearchQuery(query); }}
                        >
                          <span>🔍 {query}</span>
                          <span 
                            style={{ cursor: 'pointer', opacity: 0.6, fontWeight: 'bold', marginLeft: '10px' }} 
                            onClick={(e) => { e.stopPropagation(); setSearchHistory(searchHistory.filter((_, i) => i !== index)); }}
                          >
                            &times;
                          </span>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {activeMediaTab === 'Settings' && (
                  <motion.div key="settings-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Appearance</span>
                      <button onClick={toggleTheme} className="pill" style={{ width: '100%', margin: 0, padding: '12px', textAlign: 'center' }}>
                        {theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '15px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Network status</span>
                      <button onClick={() => setIsOffline(!isOffline)} className="pill" style={{ width: '100%', margin: 0, padding: '12px', borderColor: isOffline ? 'red' : '', textAlign: 'center' }}>
                        {isOffline ? '🔴 Go Online' : '🟢 Simulate Offline'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--panel-border)', paddingTop: '15px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Blacklisted sites</span>
                      {blacklistedSites.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>No sites blacklisted yet.</span>
                      ) : (
                        <button 
                          onClick={() => setBlacklistedSites([])} 
                          className="pill" 
                          style={{ width: '100%', margin: 0, padding: '10px', background: 'rgba(255, 71, 87, 0.1)', borderColor: '#ff4757', color: '#ff4757', textAlign: 'center' }}
                        >
                          Clear Blacklist ({blacklistedSites.length})
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Column 4: Right Sidebar */}
        <aside className="column glass-panel sidebar-nav">
          <button onClick={toggleTheme} className="nav-item" style={{background:'none', border:'none', outline:'none'}} title="Toggle Theme">
            <span style={{fontSize: '1.4rem'}}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span style={{ fontSize: '0.7rem', marginTop: '2px' }}>Theme</span>
          </button>
          <div style={{ borderTop: '1px solid var(--panel-border)', width: '100%', margin: '4px 0' }}></div>
          {sidebarTabs.map(tab => (
            <div key={tab} className={`nav-item ${activeMediaTab === tab ? 'active' : ''}`} onClick={() => setActiveMediaTab(tab)} title={tab}>
              {tab === 'All' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              )}
              {tab === 'Images' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              )}
              {tab === 'Videos' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              )}
              {tab === 'Saved' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              )}
              {tab === 'Links' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              )}
              {tab === 'History' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              )}
              {tab === 'Settings' && (
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              )}
              <span style={{ fontSize: '0.7rem', marginTop: '2px' }}>{tab}</span>
            </div>
          ))}
        </aside>

      </main>
    </div>
  );
}
