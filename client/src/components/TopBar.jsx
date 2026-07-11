import { Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { fetchSuggestions } from "../api/search";
import SettingsPopup from "./SettingsPopup";

export default function TopBar({ toggleTheme, theme }) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);

  const handleSearch = useCallback(
    (q) => {
      if (!q?.trim()) return;
      search(q.trim());
      setShowSuggestions(false);
    },
    [search]
  );

  const handleInput = useCallback(
    (e) => {
      const val = e.target.value;
      setInput(val);
      if (val.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      clearTimeout(inputRef.current?._debounce);
      const id = setTimeout(async () => {
        const s = await fetchSuggestions(val);
        setSuggestions(s);
        setShowSuggestions(s.length > 0);
      }, 200);
      if (inputRef.current) inputRef.current._debounce = id;
    },
    []
  );

  const handleSuggestionClick = (s) => {
    setInput(s);
    setShowSuggestions(false);
    handleSearch(s);
  };

  return (
    <div className="relative z-50 flex items-center gap-3 px-4 py-2.5 bg-panel/80 backdrop-blur-xl border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="size-6 rounded-sm bg-accent flex items-center justify-center">
          <Sparkles size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-text">
          QWRY
        </span>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-2xl">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(input)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={query || "Search the web..."}
            className="w-full h-9 pl-9 pr-3 rounded-full bg-hover border border-border text-sm text-text placeholder:text-dim outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
          />
        </div>
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-elevated border border-border shadow-xl backdrop-blur-xl overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => handleSuggestionClick(s)}
                className="w-full px-4 py-2 text-left text-sm text-text hover:bg-hover transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Profile */}
      <div className="size-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs font-semibold text-accent shrink-0">
        U
      </div>

      {/* Settings */}
      <SettingsPopup toggleTheme={toggleTheme} theme={theme} />
    </div>
  );
}
