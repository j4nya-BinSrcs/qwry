import { create } from "zustand";
import * as api from "../api/workspaceStation";

export const useWorkspaceStationStore = create((set, get) => ({
  reads: [],
  highlights: [],
  notes: [],
  pins: [],
  images: [],
  videos: [],
  comparisons: [],
  timeline: [],
  tags: [],
  stats: null,
  error: null,

  clearError: () => set({ error: null }),

  loadAll: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const data = await api.loadAll(sessionId, wsId);
      set({
        reads: data.reads || [],
        highlights: data.highlights || [],
        notes: data.notes || [],
        pins: data.pins || [],
        images: data.images || [],
        videos: data.videos || [],
        comparisons: data.comparisons || [],
        timeline: data.timeline || [],
        tags: data.tags || [],
        stats: data.stats || null,
      });
      return data;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  // ── Reads ──────────────────────────────────────────────────────────

  loadReads: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listReads(sessionId, wsId);
      set({ reads: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createRead: async (sessionId, wsId, itemId, status) => {
    set({ error: null });
    try {
      const entry = await api.createRead(sessionId, wsId, itemId, status);
      set((s) => ({ reads: [...s.reads, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateReadStatus: async (sessionId, wsId, entryId, status) => {
    set({ error: null });
    try {
      const entry = await api.updateReadStatus(sessionId, wsId, entryId, status);
      set((s) => ({ reads: s.reads.map((r) => (r.id === entryId ? entry : r)) }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteRead: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteRead(sessionId, wsId, entryId);
      set((s) => ({ reads: s.reads.filter((r) => r.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Highlights ─────────────────────────────────────────────────────

  loadHighlights: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listHighlights(sessionId, wsId);
      set({ highlights: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createHighlight: async (sessionId, wsId, data) => {
    set({ error: null });
    try {
      const entry = await api.createHighlight(sessionId, wsId, data);
      set((s) => ({ highlights: [...s.highlights, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteHighlight: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteHighlight(sessionId, wsId, entryId);
      set((s) => ({ highlights: s.highlights.filter((h) => h.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Notes ──────────────────────────────────────────────────────────

  loadNotes: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listNotes(sessionId, wsId);
      set({ notes: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createNote: async (sessionId, wsId, title, content) => {
    set({ error: null });
    try {
      const entry = await api.createNote(sessionId, wsId, title, content);
      set((s) => ({ notes: [...s.notes, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateNote: async (sessionId, wsId, entryId, data) => {
    set({ error: null });
    try {
      const entry = await api.updateNote(sessionId, wsId, entryId, data);
      set((s) => ({ notes: s.notes.map((n) => (n.id === entryId ? entry : n)) }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteNote: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteNote(sessionId, wsId, entryId);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Pins ───────────────────────────────────────────────────────────

  loadPins: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listPins(sessionId, wsId);
      set({ pins: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createPin: async (sessionId, wsId, pinnableType, pinnableId) => {
    set({ error: null });
    try {
      const entry = await api.createPin(sessionId, wsId, pinnableType, pinnableId);
      set((s) => ({ pins: [...s.pins, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  reorderPins: async (sessionId, wsId, pinIds) => {
    set({ error: null });
    try {
      const items = await api.reorderPins(sessionId, wsId, pinIds);
      set({ pins: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  deletePin: async (sessionId, wsId, entryId) => {
    try {
      await api.deletePin(sessionId, wsId, entryId);
      set((s) => ({ pins: s.pins.filter((p) => p.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Images ─────────────────────────────────────────────────────────

  loadImages: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listImages(sessionId, wsId);
      set({ images: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createImage: async (sessionId, wsId, data) => {
    set({ error: null });
    try {
      const entry = await api.createImage(sessionId, wsId, data);
      set((s) => ({ images: [...s.images, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteImage: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteImage(sessionId, wsId, entryId);
      set((s) => ({ images: s.images.filter((i) => i.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Videos ─────────────────────────────────────────────────────────

  loadVideos: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listVideos(sessionId, wsId);
      set({ videos: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createVideo: async (sessionId, wsId, data) => {
    set({ error: null });
    try {
      const entry = await api.createVideo(sessionId, wsId, data);
      set((s) => ({ videos: [...s.videos, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateVideo: async (sessionId, wsId, entryId, data) => {
    set({ error: null });
    try {
      const entry = await api.updateVideo(sessionId, wsId, entryId, data);
      set((s) => ({ videos: s.videos.map((v) => (v.id === entryId ? entry : v)) }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteVideo: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteVideo(sessionId, wsId, entryId);
      set((s) => ({ videos: s.videos.filter((v) => v.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Comparisons ────────────────────────────────────────────────────

  loadComparisons: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listComparisons(sessionId, wsId);
      set({ comparisons: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createComparison: async (sessionId, wsId, title, data) => {
    set({ error: null });
    try {
      const entry = await api.createComparison(sessionId, wsId, title, data);
      set((s) => ({ comparisons: [...s.comparisons, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  updateComparison: async (sessionId, wsId, entryId, data) => {
    set({ error: null });
    try {
      const entry = await api.updateComparison(sessionId, wsId, entryId, data);
      set((s) => ({ comparisons: s.comparisons.map((c) => (c.id === entryId ? entry : c)) }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteComparison: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteComparison(sessionId, wsId, entryId);
      set((s) => ({ comparisons: s.comparisons.filter((c) => c.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Timeline ───────────────────────────────────────────────────────

  loadTimeline: async (sessionId, wsId, limit) => {
    set({ error: null });
    try {
      const items = await api.listTimeline(sessionId, wsId, limit);
      set({ timeline: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Tags ───────────────────────────────────────────────────────────

  loadTags: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const items = await api.listTags(sessionId, wsId);
      set({ tags: items });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createTag: async (sessionId, wsId, name, color) => {
    set({ error: null });
    try {
      const entry = await api.createTag(sessionId, wsId, name, color);
      set((s) => ({ tags: [...s.tags, entry] }));
      return entry;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  deleteTag: async (sessionId, wsId, entryId) => {
    try {
      await api.deleteTag(sessionId, wsId, entryId);
      set((s) => ({ tags: s.tags.filter((t) => t.id !== entryId) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  assignTag: async (sessionId, wsId, tagId, objectType, objectId) => {
    set({ error: null });
    try {
      return await api.assignTag(sessionId, wsId, tagId, objectType, objectId);
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  unassignTag: async (sessionId, wsId, tagId, objectType, objectId) => {
    set({ error: null });
    try {
      return await api.unassignTag(sessionId, wsId, tagId, objectType, objectId);
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  // ── Stats / Search ─────────────────────────────────────────────────

  loadStats: async (sessionId, wsId) => {
    set({ error: null });
    try {
      const s = await api.getStats(sessionId, wsId);
      set({ stats: s });
      return s;
    } catch (err) {
      set({ error: err.message });
      return null;
    }
  },

  searchWorkspace: async (sessionId, wsId, q) => {
    set({ error: null });
    try {
      return await api.searchWorkspace(sessionId, wsId, q);
    } catch (err) {
      set({ error: err.message });
      return [];
    }
  },
}));
