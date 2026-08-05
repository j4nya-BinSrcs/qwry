import { Home, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useUIStore } from "../stores/uiStore";
import { fetchSuggestions } from "../api/search";
import ProfileMenu from "./ProfileMenu";

export default function TopBar() {
  const query = useSearchStore((s) => s.query);
  const search = useSearchStore((s) => s.search);

  const [input, setInput] = useState(query || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const submittedRef = useRef(false);
  const inputRef = useRef(null);

  const contextMode = useUIStore((s) => s.contextMode);
  const setContextMode = useUIStore((s) => s.setContextMode);

  useEffect(() => {
    if (query !== undefined) {
      setInput(query);
    }
  }, [query]);

  const dismissSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  const handleSearch = useCallback(
    (q) => {
      if (!q?.trim()) return;
      search(q.trim());
      submittedRef.current = true;
      dismissSuggestions();
    },
    [search, dismissSuggestions]
  );

  const handleInput = useCallback(
    (e) => {
      const val = e.target.value;
      setInput(val);
      submittedRef.current = false;
      if (val.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      clearTimeout(inputRef.current?._debounce);
      const id = setTimeout(async () => {
        const s = await fetchSuggestions(val);
        setSuggestions(s);
        if (!submittedRef.current) setShowSuggestions(s.length > 0);
      }, 200);
      if (inputRef.current) inputRef.current._debounce = id;
    },
    []
  );

  const handleSuggestionClick = (s) => {
    setInput(s);
    submittedRef.current = true;
    dismissSuggestions();
    handleSearch(s);
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleSearch(input);
      }
      if (e.key === "Escape") {
        dismissSuggestions();
        inputRef.current?.blur();
      }
    },
    [handleSearch, input, dismissSuggestions]
  );

  const handleFocus = useCallback(() => {
    if (submittedRef.current) return;
    if (suggestions.length > 0) setShowSuggestions(true);
  }, [suggestions]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (!submittedRef.current) setShowSuggestions(false);
    }, 200);
  }, []);

  return (
    <div className="relative z-50 flex items-center gap-4 px-5 py-2.5 bg-panel/80 backdrop-blur-xl border-b border-border shadow-sm transition-all">
      {/* Logo */}
      <div 
        onClick={() => setContextMode("home")}
        className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
      >
        <div className="size-7 rounded-lg bg-gradient-to-br from-violet-500 via-cyan-500 to-pink-500 p-[1px] shadow-md group-hover:shadow-violet-500/30 transition-all duration-300">
          <div className="w-full h-full bg-surface rounded-[7px] flex items-center justify-center">
            <span className="brand-gradient-text text-xs font-black tracking-widest">Q</span>
          </div>
        </div>
        <span className="text-sm font-bold tracking-wider brand-gradient-text font-heading">
          QWRY
        </span>
      </div>

      {/* Search bar with Aceternity style glow focus (wider max-w-3xl layout) */}
      <div className="relative flex-1 max-w-3xl mx-auto">
        <div className="relative input-glow-focus rounded-full">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-violet-400 transition-colors"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search topics, pages, articles, media..."
            className="w-full h-10 pl-11 pr-4 rounded-full bg-elevated/80 backdrop-blur-sm border border-border/80 text-text text-sm placeholder:text-dim outline-none transition-all duration-300 focus:bg-elevated focus:border-violet-500/60"
          />
        </div>
        
        {/* Dropdown Suggestions */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-elevated/95 backdrop-blur-xl border border-border/80 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => handleSuggestionClick(s)}
                className="w-full px-4 py-2.5 text-left text-sm text-text hover:bg-hover hover:text-violet-400 transition-all flex items-center gap-2.5 group"
              >
                <Sparkles size={13} className="text-dim group-hover:text-violet-400 transition-colors" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {/* Home Button */}
        <button
          onClick={() => setContextMode("home")}
          className="flex items-center justify-center size-8 rounded-lg text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border transition-all duration-200"
          title="Home"
        >
          <Home size={15} />
        </button>

        {/* Profile Avatar & Settings Popup */}
        <ProfileMenu />
      </div>
    </div>
  );
}


