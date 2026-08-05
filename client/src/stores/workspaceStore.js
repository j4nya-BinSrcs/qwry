import { create } from "zustand";
import * as api from "../api/workspace";

export const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  items: [],
  itemsByWorkspace: {},
  loading: false,
  error: null,

  chatMessages: [],
  chatLoading: false,

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

  loadItemsByWorkspace: async (sessionId, wsId) => {
    if (!wsId) return;
    try {
      const items = await api.listItems(sessionId, wsId);
      set((s) => ({ itemsByWorkspace: { ...s.itemsByWorkspace, [wsId]: items } }));
    } catch {
      set((s) => ({ itemsByWorkspace: { ...s.itemsByWorkspace, [wsId]: [] } }));
    }
  },

  loadAllItems: async (sessionId, workspaces = null) => {
    const ws = workspaces || get().workspaces;
    const targets = ws.slice(0, 30);
    await Promise.all(targets.map((w) => get().loadItemsByWorkspace(sessionId, w.id)));
  },

  reorderItem: async (sessionId, itemId, order) => {
    try {
      await api.updateItem(sessionId, itemId, { order_index: order });
    } catch (err) {
      set({ error: err.message });
    }
  },

  addItem: async (sessionId, wsId, url, title, snippet, source, mediaUrl) => {
    set({ error: null });
    try {
      const item = await api.addItem(sessionId, wsId, url, title, snippet, source, mediaUrl);
      set((s) => ({ items: [...s.items, item] }));
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

  addItemsBulk: async (sessionId, wsId, items) => {
    set({ error: null });
    try {
      const result = await api.addItemsBulk(sessionId, wsId, items);
      set((s) => ({
        items: [...s.items, ...result.created],
        workspaces: s.workspaces.map((w) =>
          w.id === wsId
            ? { ...w, item_count: (w.item_count || 0) + result.created.length }
            : w
        ),
      }));
      return result;
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

  loadChatHistory: async (sessionId, wsId) => {
    if (!wsId) return;
    try {
      const data = await api.workspaceChatHistory(sessionId, wsId);
      set({ chatMessages: data.messages || [] });
    } catch {
      set({ chatMessages: [] });
    }
  },

  sendChatMessage: async (sessionId, wsId, question) => {
    if (!wsId || !question.trim()) return;
    const userMsg = { id: crypto.randomUUID(), role: "user", content: question, created_at: new Date().toISOString() };
    set((s) => ({ chatMessages: [...s.chatMessages, userMsg], chatLoading: true }));
    try {
      const result = await api.workspaceChat(sessionId, wsId, question);
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        sources: result.sources || [],
        created_at: new Date().toISOString(),
      };
      set((s) => ({ chatMessages: [...s.chatMessages, assistantMsg], chatLoading: false }));
      return result;
    } catch (err) {
      set({ chatLoading: false, error: err.message });
      return null;
    }
  },

  clearChatHistory: () => set({ chatMessages: [] }),
}));
