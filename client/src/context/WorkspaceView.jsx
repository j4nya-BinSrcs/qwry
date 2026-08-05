import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import StationView from "./StationView";
import CanvasView from "./CanvasView";

export default function WorkspaceView() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const [mode, setMode] = useState("station");

  useEffect(() => {
    if (sessionId) loadWorkspaces(sessionId);
  }, [sessionId, loadWorkspaces]);

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border">
        <button onClick={() => setMode("station")}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            mode === "station"
              ? "bg-hover text-text font-medium"
              : "text-muted hover:text-text hover:bg-hover"
          }`}
        >Station</button>
        <button onClick={() => setMode("canvas")}
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            mode === "canvas"
              ? "bg-hover text-text font-medium"
              : "text-muted hover:text-text hover:bg-hover"
          }`}
        >Canvas</button>
      </div>
      <div className="flex-1 min-h-0">
        {mode === "station" ? <StationView /> : <CanvasView />}
      </div>
    </div>
  );
}
