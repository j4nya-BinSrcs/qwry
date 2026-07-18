import { Maximize2, Minimize2 } from "lucide-react";
import { useUIStore } from "../stores/uiStore";
import SearchAssist from "../context/SearchAssist";
import WorkspaceView from "../context/WorkspaceView";
import ReaderView from "../context/ReaderView";
import SummarizerView from "../context/SummarizerView";

const MODES = [
  { id: "search-assist", label: "Search Assist" },
  { id: "workspaces", label: "Station" },
  { id: "reader", label: "Reader" },
  { id: "summarizer", label: "Summarizer" },
];

export default function ContextPanel() {
  const contextMode = useUIStore((s) => s.contextMode);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const expandedPanel = useUIStore((s) => s.expandedPanel);
  const toggleExpand = useUIStore((s) => s.toggleExpand);
  const isExpanded = expandedPanel === "context";

  return (
    <div className="h-full flex flex-col">
      {/* Mode tabs */}
      <div className="shrink-0 flex items-center border-b border-border">
        <div className="flex-1 flex">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setContextMode(m.id)}
              className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                contextMode === m.id
                  ? "text-text"
                  : "text-muted hover:text-text"
              }`}
            >
              {m.label}
              {contextMode === m.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-text" />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => toggleExpand("context")}
          className="p-1.5 mr-1 rounded text-dim hover:text-text hover:bg-hover transition-colors"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {contextMode === "search-assist" && <SearchAssist />}
        {contextMode === "workspaces" && <WorkspaceView />}
        {contextMode === "reader" && <ReaderView />}
        {contextMode === "summarizer" && <SummarizerView />}
      </div>
    </div>
  );
}
