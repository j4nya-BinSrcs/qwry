import { DndContext, DragOverlay } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import { useSessionStore } from "./stores/sessionStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useUIStore } from "./stores/uiStore";

export default function App() {
  const [activeDrag, setActiveDrag] = useState(null);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const sessionId = useSessionStore((s) => s.sessionId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const reorderItem = useWorkspaceStore((s) => s.reorderItem);
  const items = useWorkspaceStore((s) => s.items);
  const setItems = useWorkspaceStore((s) => s.setItems);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const handleDragStart = useCallback((event) => {
    setActiveDrag(event.active);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const sourceData = active.data?.current;

      if (sourceData?.type === "workspace-item") {
        if (active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(items, oldIndex, newIndex);
        setItems(reordered);
        reordered.forEach((item, idx) => {
          reorderItem(sessionId, item.id, idx);
        });
        return;
      }

      if (!activeWsId) return;
      if (sourceData?.type !== "search-result") return;
      const result = sourceData.result;
      if (result) {
        addItem(sessionId, activeWsId, result.url, result.title, result.snippet, result.source);
      }
    },
    [sessionId, activeWsId, addItem, items, reorderItem, setItems]
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
          <div className="drag-overlay border border-border rounded-lg px-4 py-3 max-w-64">
            <div className="text-sm font-medium text-text truncate">
              {activeDrag.data?.current?.result?.title || "Dragging..."}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
