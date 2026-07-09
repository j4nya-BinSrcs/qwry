import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useCallback, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import { useSessionStore } from "./stores/sessionStore";
import { useWorkspaceStore } from "./stores/workspaceStore";

export default function App() {
  const [activeDrag, setActiveDrag] = useState(null);
  const sessionId = useSessionStore((s) => s.sessionId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over || !activeWsId) return;
      const sourceData = active.data?.current;
      if (sourceData?.type !== "search-result") return;
      const result = sourceData.result;
      if (result) {
        addItem(sessionId, activeWsId, result.url, result.title, result.snippet, result.source);
      }
    },
    [sessionId, activeWsId, addItem]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <AppLayout />
      <DragOverlay>
        {activeDrag ? (
          <div className="drag-overlay bg-elevated border border-border rounded-lg px-4 py-3 shadow-2xl max-w-64">
            <div className="text-sm font-medium text-text truncate">
              {activeDrag.data?.current?.result?.title || "Dragging..."}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}