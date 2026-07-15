import { Search, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { fetchSuggestions } from "../api/search";
import SettingsPopup from "./SettingsPopup";

export default function TopBar() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    <div className="relative z-50 flex items-center gap-4 px-4 py-3 bg-white border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="size-6 rounded bg-black flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">Q</span>
        </div>
        <span className="text-sm font-semibold tracking-tight text-text">
          QWRY
        </span>
      </div>

      {/* Search bar - positioned to overlap Sources/Center boundary */}
      <div className="relative flex-1 max-w-xl">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(input)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Cofftset"
            className="w-full h-11 pl-11 pr-4 rounded-full bg-white border border-border text-text text-sm placeholder:text-dim outline-none focus:border-text transition-colors"
          />
        </div>
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg bg-white border border-border overflow-hidden">
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
      <div className="size-7 rounded-full border border-border flex items-center justify-center text-xs font-semibold text-text shrink-0">
        U
      </div>

      {/* Settings */}
      <SettingsPopup
        open={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />
    </div>
  );
}
