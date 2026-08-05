import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { searchApi } from '../services/api';

const SearchContext = createContext();

export const SearchProvider = ({ children }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [results, setResults] = useState([]);
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [news, setNews] = useState([]);
  const [aiOverview, setAiOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [queryTime, setQueryTime] = useState('0.20s');
  const [isOffline, setIsOffline] = useState(false);

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('qwry_history');
      return saved ? JSON.parse(saved) : ['web design', 'react docs', 'glassmorphism'];
    } catch {
      return ['web design', 'react docs', 'glassmorphism'];
    }
  });

  const saveHistory = (newQuery) => {
    if (!newQuery || !newQuery.trim()) return;
    const clean = newQuery.trim();
    setHistory(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 20);
      localStorage.setItem('qwry_history', JSON.stringify(updated));
      return updated;
    });
  };

  const removeHistoryItem = (itemToRemove) => {
    setHistory(prev => {
      const updated = prev.filter(q => q !== itemToRemove);
      localStorage.setItem('qwry_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('qwry_history');
  };

  const executeSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) return;
    setIsLoading(true);
    setQuery(searchQuery);
    saveHistory(searchQuery);

    if (isOffline) {
      setIsLoading(false);
      return;
    }

    try {
      const searchRes = await searchApi.search(searchQuery);
      setResults(searchRes.results || []);
      setQueryTime(searchRes.queryTime || '0.15s');

      const [imgRes, vidRes, newsRes, aiRes] = await Promise.all([
        searchApi.images(searchQuery),
        searchApi.videos(searchQuery),
        searchApi.news(searchQuery),
        searchApi.aiOverview(searchQuery, searchRes.results || [])
      ]);

      setImages(imgRes.images || []);
      setVideos(vidRes.videos || []);
      setNews(newsRes.articles || []);
      setAiOverview(aiRes);
    } catch (err) {
      console.error('[Qwry SearchContext] Error executing search', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOffline]);

  return (
    <SearchContext.Provider
      value={{
        query,
        setQuery,
        activeCategory,
        setActiveCategory,
        results,
        images,
        videos,
        news,
        aiOverview,
        isLoading,
        queryTime,
        history,
        removeHistoryItem,
        clearHistory,
        executeSearch,
        isOffline,
        setIsOffline
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => useContext(SearchContext);
