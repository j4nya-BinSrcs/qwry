import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import StationView from "./StationView";
import CanvasView from "./CanvasView";

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
      <div className="flex-1 min-h-0">
        {mode === "station" ? (
          <StationView mode={mode} setMode={setMode} chatOpen={chatOpen} setChatOpen={setChatOpen} />
        ) : (
          <CanvasView mode={mode} setMode={setMode} chatOpen={chatOpen} setChatOpen={setChatOpen} />
        )}
      </div>
    </div>
  );
}
