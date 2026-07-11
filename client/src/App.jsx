import { DndContext, DragOverlay } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useEffect, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import { useSessionStore } from "./stores/sessionStore";
import { useWorkspaceStore } from "./stores/workspaceStore";

function getInitialTheme() {
  try {
    const stored = localStorage.getItem("qwry_theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [activeDrag, setActiveDrag] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const sessionId = useSessionStore((s) => s.sessionId);
  const addItem = useWorkspaceStore((s) => s.addItem);
  const reorderItem = useWorkspaceStore((s) => s.reorderItem);
  const items = useWorkspaceStore((s) => s.items);
  const setItems = useWorkspaceStore((s) => s.setItems);
  const activeWsId = useWorkspaceStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    try { localStorage.setItem("qwry_theme", theme); } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

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
      <AppLayout toggleTheme={toggleTheme} theme={theme} />
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