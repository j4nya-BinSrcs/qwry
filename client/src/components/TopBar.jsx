import { Search, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useUIStore } from "../stores/uiStore";
import { fetchSuggestions } from "../api/search";
import SettingsPopup from "./SettingsPopup";

export default function TopBar() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const submittedRef = useRef(false);
  const inputRef = useRef(null);

  const contextMode = useUIStore((s) => s.contextMode);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const search = useSearchStore((s) => s.search);
  const storeQuery = useSearchStore((s) => s.query);
  const provider = useSearchStore((s) => s.provider);

  useEffect(() => {
    if (storeQuery && storeQuery !== input) {
      setInput(storeQuery);
      submittedRef.current = true;
    }
  }, [storeQuery]);

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
        const s = await fetchSuggestions(val, provider);
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
    <div className="relative z-50 flex items-center gap-4 px-4 py-3 bg-surface">
      {/* Logo - clickable to go home */}
      <button
        onClick={() => setContextMode("home")}
        className="flex items-center gap-2 shrink-0 text-dim hover:text-text transition-colors"
        title="Home"
        style={{ cursor: "pointer" }}
      >
        <div className="size-6 rounded-lg bg-text flex items-center justify-center">
          <span className="text-surface text-base font-bold">Q</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-text">
          QWRY
        </span>
      </button>

      {/* Centered Search bar */}
      <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-xl pointer-events-none my-2">
        <div className="relative pointer-events-auto">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search the web..."
            className="w-full h-11 pl-12 pr-4 rounded-xl bg-elevated border border-border text-text text-sm placeholder:text-dim outline-none focus:border-text transition-colors"
          />
        </div>
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-lg bg-elevated border border-border shadow-pop overflow-hidden">
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

      {/* Settings */}
      <SettingsPopup
        open={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />
    </div>
  );
}
