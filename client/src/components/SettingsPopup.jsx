import { useState } from "react";
import { Settings, Sun, Moon, ChevronDown } from "lucide-react";
import { useSearchStore, providers } from "../stores/searchStore";

export default function SettingsPopup({ toggleTheme, theme }) {
  const [open, setOpen] = useState(false);
  const provider = useSearchStore((s) => s.provider);
  const setProvider = useSearchStore((s) => s.setProvider);
  const search = useSearchStore((s) => s.search);
  const query = useSearchStore((s) => s.query);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center size-7 rounded-md bg-hover border border-border text-dim hover:text-text hover:bg-hover/80 transition-colors"
        title="Settings"
      >
        <Settings size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-52 rounded-lg bg-elevated border border-border shadow-xl backdrop-blur-xl overflow-hidden z-50">
            <div className="px-3 py-2 text-xs text-muted font-medium border-b border-border">
              Settings
            </div>

            {/* Theme */}
            <div className="px-3 py-2 border-b border-border">
              <div className="text-xs text-muted mb-1.5">Theme</div>
              <button
                onClick={() => { toggleTheme(); setOpen(false); }}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-text hover:bg-hover transition-colors"
              >
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
            </div>

            {/* Search provider */}
            <div className="px-3 py-2">
              <div className="text-xs text-muted mb-1.5">Search Provider</div>
              {providers.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setProvider(p.value);
                    if (query) search(query.trim(), 1, p.value);
                  }}
                  className={`w-full px-2 py-1.5 text-left text-xs transition-colors rounded ${
                    provider === p.value
                      ? "bg-accent/10 text-accent"
                      : "text-text hover:bg-hover"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
