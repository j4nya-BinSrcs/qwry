import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Zap, FileText, Scale, Sparkles, HelpCircle } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useSearchStore } from '../../stores/searchStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import WorkspaceNameModal from './WorkspaceNameModal';

const PLACEHOLDERS = [
  { text: 'Search the web…', icon: Search },
  { text: 'Ask a research question…', icon: HelpCircle },
  { text: 'Find papers on [topic]…', icon: FileText },
  { text: 'Compare [A] vs [B]…', icon: Scale },
  { text: 'Summarize a URL…', icon: Sparkles },
];

const QUICK_ACTIONS = [
  { label: 'Summarize clipboard URL', shortcut: '⌘⇧S', action: 'summarize-clipboard', icon: Sparkles },
  { label: 'Compare two sources', shortcut: '⌘⇧C', action: 'compare', icon: Scale },
  { label: 'New workspace', shortcut: '⌘N', action: 'new-workspace', icon: Zap },
];

function RotatingPlaceholder({ paused, hidden, className }) {
  const [text, setText] = useState(PLACEHOLDERS[0].text);
  const [currentIcon, setCurrentIcon] = useState(PLACEHOLDERS[0].icon);
  const stateRef = useRef({ phrase: 0, char: PLACEHOLDERS[0].text.length, deleting: false });

  useEffect(() => {
    if (paused) return;
    let timer;
    const tick = () => {
      const st = stateRef.current;
      const current = PLACEHOLDERS[st.phrase];
      if (!st.deleting) {
        const next = st.char + 1;
        st.char = next;
        setText(current.text.slice(0, next));
        if (next >= current.text.length) {
          st.deleting = true;
          timer = setTimeout(tick, 1700);
        } else {
          timer = setTimeout(tick, 45);
        }
      } else {
        const next = st.char - 1;
        st.char = next;
        setText(current.text.slice(0, next));
        if (next <= 0) {
          st.deleting = false;
          st.phrase = (st.phrase + 1) % PLACEHOLDERS.length;
          setCurrentIcon(PLACEHOLDERS[st.phrase].icon);
          timer = setTimeout(tick, 350);
        } else {
          timer = setTimeout(tick, 22);
        }
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [paused]);

  const Icon = currentIcon;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        opacity: hidden ? 0 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      <Icon key={currentIcon} size={16} className="text-dim placeholder-icon" />
      <span>{text}</span>
    </span>
  );
}

function SuggestionItem({ suggestion, onClick, index }) {
  return (
    <button
      key={index}
      onMouseDown={onClick}
      className="qwry-dropdown-item flex items-center gap-3"
    >
      <Search size={16} className="text-dim shrink-0" />
      <span className="truncate">{suggestion}</span>
    </button>
  );
}

function QuickActionItem({ action, onClick }) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      className="qwry-dropdown-item flex items-center gap-3"
    >
      <div className="size-8 rounded-lg bg-elevated flex items-center justify-center shrink-0">
        <Icon size={16} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{action.label}</div>
      </div>
      <kbd className="px-2 py-0.5 rounded text-xs text-dim bg-hover font-mono">{action.shortcut}</kbd>
    </button>
  );
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  placeholder,
  autoFocus,
  showSuggestions = true,
  className = '',
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const { fetchSuggestions } = useSearchStore();

  const provider = useSearchStore((s) => s.provider);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const search = useSearchStore((s) => s.search);
  const sessionId = useSessionStore((s) => s.sessionId);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    onChange?.(val);
    setSubmitted(false);

    if (val.length < 2) {
      setSuggestions([]);
      if (showDropdown) setShowDropdown(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const s = await fetchSuggestions(val, provider);
      if (s.length > 0) {
        setSuggestions(s);
        if (!submitted) setShowDropdown(true);
      }
    }, 200);
  }, [onChange, fetchSuggestions, provider, submitted, showDropdown]);

  const handleFocus = useCallback((e) => {
    setIsFocused(true);
    if (!submitted && suggestions.length > 0) setShowDropdown(true);
    onFocus?.(e);
  }, [onFocus, submitted, suggestions.length]);

  const handleBlur = useCallback((e) => {
    setTimeout(() => {
      if (!submitted) {
        setIsFocused(false);
        setShowDropdown(false);
      }
      onBlur?.(e);
    }, 200);
  }, [onBlur, submitted]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setSubmitted(true);
      setShowDropdown(false);
      const q = value.trim();
      if (q) {
        search(q);
        setContextMode('search-assist');
        onSubmit?.(q);
      }
    }
  }, [value, search, setContextMode, onSubmit]);

  const handleSuggestionClick = useCallback((s) => {
    setSubmitted(true);
    setShowDropdown(false);
    search(s);
    setContextMode('search-assist');
    onSubmit?.(s);
  }, [search, setContextMode, onSubmit]);

  const handleQuickAction = useCallback((action) => {
    setSubmitted(true);
    setShowDropdown(false);
    switch (action.action) {
      case 'summarize-clipboard':
        navigator.clipboard.readText().then((text) => {
          if (text && text.startsWith('http')) {
            useUIStore.getState().openSummarizer(text, 'Clipboard URL');
            setContextMode('summarizer');
          }
        }).catch(() => {});
        break;
      case 'compare':
        setContextMode('workspace');
        break;
      case 'new-workspace':
        setCreateWsOpen(true);
        break;
    }
  }, [sessionId, createWorkspace, setContextMode]);

  return (
    <div className={`search-bar relative ${className}`}>
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text pointer-events-none transition-opacity duration-150"
          style={{ opacity: isFocused ? 1 : 0 }}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder=""
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-elevated/80 backdrop-blur-sm border border-border text-text text-base placeholder:text-dim outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-fast"
          aria-label="Search the web"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={showDropdown && suggestions.length > 0}
        />
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          className="absolute top-full left-0 right-0 mt-2 rounded-xl qwry-dropdown shadow-pop overflow-hidden animate-pop-in z-50"
          role="listbox"
        >
          {suggestions.length > 0 && (
            <>
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-dim uppercase tracking-wider">Suggestions</p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <SuggestionItem
                    key={i}
                    suggestion={s}
                    index={i}
                    onClick={() => handleSuggestionClick(s)}
                    role="option"
                  />
                ))}
              </div>
            </>
          )}
          <div className="px-2 py-2 border-t border-border">
            <p className="text-xs text-dim uppercase tracking-wider mb-2">Quick Actions</p>
            <div className="qwry-popup-list">
              {QUICK_ACTIONS.map((action, i) => (
                <QuickActionItem key={i} action={action} onClick={() => handleQuickAction(action)} />
              ))}
            </div>
          </div>
        </div>
      )}

      <RotatingPlaceholder
        paused={isFocused || value.length > 0}
        hidden={isFocused}
        className="absolute inset-0 flex items-center pl-12 pr-4 text-base pointer-events-none"
      />

      <WorkspaceNameModal
        open={createWsOpen}
        title="New workspace"
        subtitle="Give your new workspace a name to get started."
        placeholder="Workspace name"
        confirmLabel="Create"
        initialName=""
        onCancel={() => setCreateWsOpen(false)}
        onConfirm={async (name) => {
          await createWorkspace(sessionId, name);
          setCreateWsOpen(false);
        }}
      />
    </div>
  );
}