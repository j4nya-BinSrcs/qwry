import SearchAssist from "../context/SearchAssist";

const MODES = [
  { id: "search-assist", label: "Search Assist" },
  { id: "workspaces", label: "Workspaces" },
  { id: "tools", label: "Tools" },
  { id: "summarizer", label: "Summarizer" },
];

export default function ContextPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center border-b border-border px-3">
        <div className="flex">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`px-3 py-2.5 text-xs font-medium transition-colors relative ${
                m.id === "search-assist"
                  ? "text-text"
                  : "text-muted hover:text-text"
              }`}
            >
              {m.label}
              {m.id === "search-assist" && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-text" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <SearchAssist />
      </div>
    </div>
  );
}
