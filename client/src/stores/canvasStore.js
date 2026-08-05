import { create } from "zustand";
import * as api from "../api/canvas";

export const useCanvasStore = create((set, get) => ({
  nodes: {},
  connections: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: new Set(),
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  setViewport: (viewport) => set({ viewport }),

  selectNode: (nodeId, multi) => {
    set((s) => {
      const next = new Set(multi ? s.selectedNodeIds : []);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return { selectedNodeIds: next };
    });
  },

  clearSelection: () => set({ selectedNodeIds: new Set() }),

  loadAll: async (sessionId, wsId) => {
    set({ loading: true, error: null });
    try {
      const [nodeList, connList] = await Promise.all([
        api.listNodes(sessionId, wsId),
        api.listConnections(sessionId, wsId),
      ]);
      const nodesMap = {};
      for (const n of nodeList) nodesMap[n.id] = n;
      set({ nodes: nodesMap, connections: connList, loading: false });
      return { nodes: nodeList, connections: connList };
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  addNode: async (sessionId, wsId, data) => {
    try {
      const node = await api.createNode(sessionId, wsId, data);
      set((s) => ({ nodes: { ...s.nodes, [node.id]: node } }));
      return node;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateNode: async (sessionId, wsId, nodeId, data) => {
    try {
      const node = await api.updateNode(sessionId, wsId, nodeId, data);
      set((s) => ({ nodes: { ...s.nodes, [node.id]: node } }));
      return node;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateNodeLocal: (nodeId, data) => {
    set((s) => {
      const existing = s.nodes[nodeId];
      if (!existing) return s;
      return { nodes: { ...s.nodes, [nodeId]: { ...existing, ...data } } };
    });
  },

  removeNode: async (sessionId, wsId, nodeId) => {
    try {
      await api.deleteNode(sessionId, wsId, nodeId);
      set((s) => {
        const { [nodeId]: _, ...rest } = s.nodes;
        return {
          nodes: rest,
          connections: s.connections.filter(
            (c) => c.source_node_id !== nodeId && c.target_node_id !== nodeId,
          ),
          selectedNodeIds: (() => { const next = new Set(s.selectedNodeIds); next.delete(nodeId); return next; })(),
        };
      });
    } catch (err) {
      set({ error: err.message });
    }
  },

  addConnection: async (sessionId, wsId, data) => {
    try {
      const conn = await api.createConnection(sessionId, wsId, data);
      set((s) => ({ connections: [...s.connections, conn] }));
      return conn;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  removeConnection: async (sessionId, wsId, connId) => {
    try {
      await api.deleteConnection(sessionId, wsId, connId);
      set((s) => ({ connections: s.connections.filter((c) => c.id !== connId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
