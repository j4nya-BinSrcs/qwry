import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import StationView from "./StationView";
import CanvasView from "./CanvasView";
import ChatModal from "../components/ChatModal";

export default function WorkspaceView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const [mode, setMode] = useState("station");
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (sessionId) loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  const workspaceName = workspaces.find((w) => w.id === activeId)?.name;

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center rounded-md bg-hover border border-border p-1">
          <button onClick={() => setMode("station")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "station"
                ? "bg-elevated text-text shadow-surface"
                : "text-muted hover:text-text"
            }`}
          >Station</button>
          <button onClick={() => setMode("canvas")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "canvas"
                ? "bg-elevated text-text shadow-surface"
                : "text-muted hover:text-text"
            }`}
          >Canvas</button>
        </div>
        <button onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 px-3 py-1 rounded-md text-xs text-muted hover:text-text hover:bg-hover transition-colors"
          title="Chat about this workspace"
        ><MessageCircle size={16} /> Chat</button>
      </div>
      <div className="flex-1 min-h-0">
        {mode === "station" ? <StationView /> : <CanvasView />}
      </div>
      {chatOpen && (
        <ChatModal workspaceId={activeId} workspaceName={workspaceName} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}
