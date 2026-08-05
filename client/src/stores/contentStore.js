import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useContentStore = create(
  persist(
    (set, get) => ({
      reads: [],
      summaries: [],
      overviews: {},

      addRead: (read) =>
        set((s) => ({
          reads: [read, ...s.reads.filter((r) => r.url !== read.url)],
        })),

      addSummary: (summary) =>
        set((s) => ({
          summaries: [summary, ...s.summaries.filter((ss) => ss.url !== summary.url)],
        })),

      setOverview: (query, overview) =>
        set((s) => ({
          overviews: { ...s.overviews, [query]: overview },
        })),

      removeRead: (url) =>
        set((s) => ({
          reads: s.reads.filter((r) => r.url !== url),
        })),

      removeSummary: (url) =>
        set((s) => ({
          summaries: s.summaries.filter((ss) => ss.url !== url),
        })),
    }),
    {
      name: "qwry_content",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.reads = (state.reads || []).filter((r) => !r.loading);
        state.summaries = (state.summaries || []).filter((s) => !s.loading);
      },
    },
  ),
);
