import { create } from "zustand";
import * as api from "../api/workspace";

export const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  items: [],
  loading: false,
  error: null,

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setItems: (items) => set({ items }),

  loadWorkspaces: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const ws = await api.listWorkspaces(sessionId);
      set({ workspaces: ws, loading: false });
      if (ws.length > 0 && !get().activeWorkspaceId) {
        set({ activeWorkspaceId: ws[0].id });
      }
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  updateWorkspace: async (sessionId, wsId, name, description) => {
    set({ error: null });
    try {
      const ws = await api.updateWorkspace(sessionId, wsId, name, description);
      set((s) => ({
        workspaces: s.workspaces.map((w) => (w.id === wsId ? ws : w)),
      }));
      return ws;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  createWorkspace: async (sessionId, name, description) => {
    set({ loading: true, error: null });
    try {
      const ws = await api.createWorkspace(sessionId, name, description);
      set((s) => ({
        workspaces: [ws, ...s.workspaces],
        activeWorkspaceId: ws.id,
        items: [],
        loading: false,
      }));
      return ws;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  deleteWorkspace: async (sessionId, wsId) => {
    try {
      await api.deleteWorkspace(sessionId, wsId);
      set((s) => {
        const ws = s.workspaces.filter((w) => w.id !== wsId);
        return {
          workspaces: ws,
          activeWorkspaceId:
            s.activeWorkspaceId === wsId
              ? ws[0]?.id || null
              : s.activeWorkspaceId,
          items: s.activeWorkspaceId === wsId ? [] : s.items,
        };
      });
    } catch (err) {
      set({ error: err.message });
    }
  },

  loadItems: async (sessionId, wsId) => {
    if (!wsId) return;
    set({ loading: true, error: null });
    try {
      const items = await api.listItems(sessionId, wsId);
      set({ items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addItem: async (sessionId, wsId, url, title, snippet, source) => {
    set({ error: null });
    try {
      const item = await api.addItem(sessionId, wsId, url, title, snippet, source);
      set((s) => ({ items: [...s.items, item] }));
      // refresh item_count on workspace
      set((s) => ({
        workspaces: s.workspaces.map((w) =>
          w.id === wsId ? { ...w, item_count: (w.item_count || 0) + 1 } : w
        ),
      }));
      return item;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  summarizingId: null,

  summarizeItem: async (sessionId, itemId, retries = 3) => {
    set({ summarizingId: itemId, error: null });
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await api.summarizeItem(sessionId, itemId);
        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId
              ? { ...i, summary: result.summary, summary_provider: result.provider, summary_model: result.model }
              : i
          ),
          summarizingId: null,
        }));
        return;
      } catch (err) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
        } else {
          set({ error: err.message, summarizingId: null });
        }
      }
    }
  },

  deleteItem: async (sessionId, itemId) => {
    try {
      await api.deleteItem(sessionId, itemId);
      set((s) => {
        const removed = s.items.find((i) => i.id === itemId);
        return {
          items: s.items.filter((i) => i.id !== itemId),
          workspaces: removed
            ? s.workspaces.map((w) =>
                w.id === removed.workspace_id
                  ? { ...w, item_count: Math.max(0, (w.item_count || 0) - 1) }
                  : w
              )
            : s.workspaces,
        };
      });
    } catch (err) {
      set({ error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));