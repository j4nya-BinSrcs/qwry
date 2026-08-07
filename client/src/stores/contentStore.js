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

      hydrateReads: (list) =>
        set((s) => {
          const existing = new Set(s.reads.map((r) => r.url));
          const fresh = list.filter((r) => !existing.has(r.url) && !r.loading);
          return { reads: [...s.reads, ...fresh] };
        }),

      hydrateSummaries: (list) =>
        set((s) => {
          const existing = new Set(s.summaries.map((ss) => ss.url));
          const fresh = list.filter((x) => !existing.has(x.url) && !x.loading);
          return { summaries: [...s.summaries, ...fresh] };
        }),

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
      version: 2,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.reads = (state.reads || []).filter((r) => !r.loading);
        state.summaries = (state.summaries || []).filter((s) => !s.loading);
      },
    },
  ),
);
