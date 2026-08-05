import { Maximize2, Minimize2, Sparkles, Layers, BookOpen, FileText } from "lucide-react";
import { useUIStore } from "../stores/uiStore";
import SearchAssist from "../context/SearchAssist";
import WorkspaceView from "../context/WorkspaceView";
import ReaderView from "../context/ReaderView";
import SummarizerView from "../context/SummarizerView";

const MODES = [
  { id: "search-assist", label: "Search Assist", icon: Sparkles },
  { id: "workspace", label: "Workspace", icon: Layers },
  { id: "reader", label: "Reader", icon: BookOpen },
  { id: "summarizer", label: "Summarizer", icon: FileText },
];

export default function ContextPanel() {
  const contextMode = useUIStore((s) => s.contextMode);
  const setContextMode = useUIStore((s) => s.setContextMode);
  const expandedPanel = useUIStore((s) => s.expandedPanel);
  const toggleExpand = useUIStore((s) => s.toggleExpand);
  const isExpanded = expandedPanel === "context";

  return (
    <div className="h-full flex flex-col">
      {/* Mode tabs header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border/80 bg-surface/40 backdrop-blur-md px-2">
        <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = contextMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setContextMode(m.id)}
                className={`relative px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                  isActive
                    ? "text-text bg-panel/80 border border-violet-500/30 shadow-md shadow-violet-500/10"
                    : "text-muted hover:text-text hover:bg-hover/60 border border-transparent"
                }`}
              >
                <Icon size={13} className={isActive ? "text-violet-400" : "text-dim"} />
                <span>{m.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => toggleExpand("context")}
          className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-hover border border-transparent hover:border-border/60 transition-all shrink-0 ml-1"
          title={isExpanded ? "Collapse panel" : "Expand panel"}
        >
          {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-surface/30">
        {contextMode === "search-assist" && <SearchAssist />}
        {contextMode === "workspace" && <WorkspaceView />}
        {contextMode === "reader" && <ReaderView />}
        {contextMode === "summarizer" && <SummarizerView />}
      </div>
    </div>
  );
}

