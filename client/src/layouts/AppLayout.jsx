import { Search } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { fetchSuggestions } from "../api/search";
import { useSearchStore } from "../stores/searchStore";
import SourcesPanel from "../panels/SourcesPanel";
import ContextPanel from "../panels/ContextPanel";
import DiscoveryPanel from "../panels/DiscoveryPanel";

export default function AppLayout() {
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
    <div className="h-full flex flex-col bg-surface">
      <div className="shrink-0 px-10 pt-8 pb-6">
        <div className="flex items-start justify-between mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-text">
            4. MINIMAL MONO
          </h1>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-text flex items-center justify-center">
              <span className="text-sm font-semibold text-white">0</span>
            </div>
            <div className="size-9 rounded-full border-2 border-text flex items-center justify-center">
              <div className="size-3 rounded-full border-2 border-text" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-8 rounded-full bg-text flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">Q</span>
            </div>
            <span className="text-lg font-bold tracking-wide text-text">
              QWRY
            </span>
          </div>

          <div className="relative flex-1 max-w-xl">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-5 top-1/2 -translate-y-1/2 text-text"
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
                className="w-full h-12 pl-12 pr-5 rounded-xl border border-border bg-white text-text text-base placeholder:text-dim outline-none focus:border-text transition-colors"
              />
            </div>
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1.5 rounded-lg bg-white border border-border overflow-hidden z-50">
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
        </div>
      </div>

      <div className="flex-1 min-h-0 px-10 pb-8">
        <div className="h-full grid grid-cols-[280px_1fr_280px] gap-0">
          <div className="border-r border-border overflow-hidden">
            <SourcesPanel />
          </div>
          <div className="overflow-hidden">
            <ContextPanel />
          </div>
          <div className="border-l border-border overflow-hidden">
            <DiscoveryPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
