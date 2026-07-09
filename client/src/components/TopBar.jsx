import { Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { fetchSuggestions } from "../api/search";

export default function TopBar() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showWsMenu, setShowWsMenu] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);
  const sessionId = useSessionStore((s) => s.sessionId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspace);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  useEffect(() => {
    loadWorkspaces(sessionId);
  }, [sessionId]);

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
      if (inputRef.current) inputRef.current.focus();
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

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <div className="relative z-50 flex items-center gap-3 px-4 py-2.5 bg-panel/80 backdrop-blur-xl border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="size-6 rounded-md bg-accent flex items-center justify-center">
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
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-hover border border-border text-sm text-text placeholder:text-dim outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all"
          />
        </div>
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-elevated border border-border shadow-lg overflow-hidden">
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

      {/* Workspace selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowWsMenu(!showWsMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-hover border border-border text-sm text-text hover:bg-hover/80 transition-colors"
        >
          <span className="max-w-28 truncate">
            {activeWs?.name || "Workspace"}
          </span>
          <span className="text-dim text-xs">
            {activeWs?.item_count ?? 0}
          </span>
        </button>
        {showWsMenu && (
          <div className="absolute top-full right-0 mt-1 w-56 rounded-lg bg-elevated border border-border shadow-xl overflow-hidden">
            <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border">
              Workspaces
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setActive(ws.id);
                  setShowWsMenu(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                  ws.id === activeId
                    ? "bg-accent/10 text-accent"
                    : "text-text hover:bg-hover"
                }`}
              >
                <span className="truncate">{ws.name}</span>
                <span className="text-xs text-dim">{ws.item_count}</span>
              </button>
            ))}
            <button
              onClick={async () => {
                const name = prompt("Workspace name:");
                if (name) {
                  await createWorkspace(sessionId, name);
                }
                setShowWsMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-hover transition-colors border-t border-border"
            >
              + New Workspace
            </button>
          </div>
        )}
      </div>

      {/* AI indicator */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-hover/50 text-xs text-muted shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        AI
      </div>
    </div>
  );
}