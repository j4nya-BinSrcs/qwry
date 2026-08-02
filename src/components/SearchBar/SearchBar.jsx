import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { searchApi } from '../../services/api';
import { Autocomplete } from './Autocomplete';
import { useDroppable } from '@dnd-kit/core';
import './SearchBar.css';

export const SearchBar = ({ variant = 'landing', onSearchSubmit }) => {
  const { query, executeSearch, history } = useSearch();
  const [inputValue, setInputValue] = useState(query || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);

  const { isOver, setNodeRef } = useDroppable({
    id: 'search-bar-dropzone',
  });

  useEffect(() => {
    setInputValue(query || '');
  }, [query]);

  // Fetch suggestions on input change
  useEffect(() => {
    if (!inputValue || inputValue.trim().length < 2) {
      setSuggestions([]);
      setShowAutocomplete(false);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await searchApi.suggest(inputValue);
      const apiSuggestions = res.suggestions || [];
      // Combine with matching history
      const historyMatches = history
        .filter(h => h.toLowerCase().includes(inputValue.toLowerCase()))
        .map(h => ({ text: h, type: 'recent' }));

      const combined = [...historyMatches, ...apiSuggestions].slice(0, 8);
      setSuggestions(combined);
      setShowAutocomplete(combined.length > 0);
    }, 150);

    return () => clearTimeout(timer);
  }, [inputValue, history]);

  // Click & touch outside listener + auto-close on scroll
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowAutocomplete(false);
      }
    };
    const handleScroll = () => {
      setShowAutocomplete(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputValue || !inputValue.trim()) return;
    setShowAutocomplete(false);
    if (onSearchSubmit) {
      onSearchSubmit(inputValue.trim());
    } else {
      executeSearch(inputValue.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (!showAutocomplete || suggestions.length === 0) {
      if (e.key === 'Enter') handleSubmit(e);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        const selectedText = suggestions[selectedIndex].text;
        setInputValue(selectedText);
        setShowAutocomplete(false);
        if (onSearchSubmit) onSearchSubmit(selectedText);
        else executeSearch(selectedText);
      } else {
        handleSubmit(e);
      }
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  return (
    <div
      ref={(node) => {
        containerRef.current = node;
        setNodeRef(node);
      }}
      className={`search-bar-container search-bar-${variant} ${variant === 'landing' ? 'search-bar-border' : ''} ${isOver ? 'drop-target-active' : ''}`}
    >
      <form onSubmit={handleSubmit} className="search-bar-form">
        <Search className="search-icon-svg" size={variant === 'landing' ? 20 : 18} />
        <input
          type="text"
          className="search-bar-input"
          placeholder={isOver ? "Drop to search..." : "Search anything..."}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowAutocomplete(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {inputValue && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => {
              setInputValue('');
              setSuggestions([]);
              setShowAutocomplete(false);
            }}
          >
            <X size={16} />
          </button>
        )}
      </form>

      {showAutocomplete && (
        <Autocomplete
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelectSuggestion={(text) => {
            setInputValue(text);
            setShowAutocomplete(false);
            if (onSearchSubmit) onSearchSubmit(text);
            else executeSearch(text);
          }}
        />
      )}
    </div>
  );
};
