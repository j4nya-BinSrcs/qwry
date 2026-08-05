import React, { useState, useEffect } from 'react';
import { Search, BookOpen, FileText, Activity, ExternalLink, Clock } from 'lucide-react';
import { fetchSearchHistory, fetchReads, fetchSummaries, fetchActivity } from '../../api/history';
import { useSearch } from '../../context/SearchContext';
import './HistoryPanel.css';

export const HistoryPanel = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { executeSearch } = useSearch();

  useEffect(() => {
    let isMounted = true;
    async function loadTabData() {
      setIsLoading(true);
      let data = [];
      try {
        if (activeTab === 'search') {
          data = await fetchSearchHistory();
        } else if (activeTab === 'reads') {
          data = await fetchReads();
        } else if (activeTab === 'summaries') {
          data = await fetchSummaries();
        } else if (activeTab === 'activity') {
          data = await fetchActivity();
        }
      } catch (err) {
        console.warn(`[HistoryPanel] Failed to fetch ${activeTab}`, err);
      }
      if (isMounted) {
        setItems(data || []);
        setIsLoading(false);
      }
    }
    loadTabData();
    return () => { isMounted = false; };
  }, [activeTab]);

  return (
    <div className="history-panel-container">
      {/* Sub-tabs header */}
      <div className="history-subtabs">
        <button
          className={`history-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Searches ({activeTab === 'search' ? items.length : '•'})
        </button>

        <button
          className={`history-tab-btn ${activeTab === 'reads' ? 'active' : ''}`}
          onClick={() => setActiveTab('reads')}
        >
          <BookOpen size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Reading List ({activeTab === 'reads' ? items.length : '•'})
        </button>

        <button
          className={`history-tab-btn ${activeTab === 'summaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('summaries')}
        >
          <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
          AI Summaries ({activeTab === 'summaries' ? items.length : '•'})
        </button>

        <button
          className={`history-tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Activity Log ({activeTab === 'activity' ? items.length : '•'})
        </button>
      </div>

      {/* Content area */}
      <div className="history-content-list">
        {isLoading ? (
          <div className="empty-media-msg">Loading history entries...</div>
        ) : items.length === 0 ? (
          <div className="empty-media-msg">
            No {activeTab} records found in server session.
          </div>
        ) : (
          items.map((item, idx) => {
            const itemId = item.id || `hist-${idx}`;

            if (activeTab === 'search') {
              return (
                <div
                  key={itemId}
                  className="history-card-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => executeSearch(item.query)}
                >
                  <div className="history-card-meta">
                    <span className="history-card-title">🔍 {item.query}</span>
                    {item.provider && <span className="history-tag">{item.provider}</span>}
                  </div>
                  {item.searched_at && (
                    <div className="history-card-meta" style={{ marginTop: '4px' }}>
                      <span><Clock size={10} style={{ display: 'inline', marginRight: '3px' }} />{new Date(item.searched_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            }

            if (activeTab === 'reads') {
              return (
                <div key={itemId} className="history-card-item">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="history-card-title"
                  >
                    {item.title || item.url} <ExternalLink size={11} style={{ display: 'inline' }} />
                  </a>
                  {item.content && <p className="history-card-body">{item.content.slice(0, 150)}...</p>}
                  <div className="history-card-meta">
                    <span>{item.source || 'Web Page'}</span>
                    {item.saved_at && <span>{new Date(item.saved_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              );
            }

            if (activeTab === 'summaries') {
              return (
                <div key={itemId} className="history-card-item">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="history-card-title"
                  >
                    {item.title || item.url} <ExternalLink size={11} style={{ display: 'inline' }} />
                  </a>
                  {item.summary && <p className="history-card-body">{item.summary}</p>}
                  <div className="history-card-meta">
                    {item.model && <span className="history-tag">{item.model}</span>}
                    {item.saved_at && <span>{new Date(item.saved_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              );
            }

            if (activeTab === 'activity') {
              return (
                <div key={itemId} className="history-card-item">
                  <div className="history-card-meta">
                    <span className="history-card-title">{item.action_type || 'System Action'}</span>
                    {item.created_at && <span>{new Date(item.created_at).toLocaleTimeString()}</span>}
                  </div>
                  {item.details && <p className="history-card-body">{typeof item.details === 'object' ? JSON.stringify(item.details) : item.details}</p>}
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
};
