import { create } from "zustand";
import { searchQuery } from "../api/search";

export const providers = [
  { value: null, label: "Meta" },
  { value: "engine", label: "Engine" },
  { value: "searxng", label: "SearXNG" },
];

export const useSearchStore = create((set, get) => ({
  query: "",
  results: [],
  suggestions: [],
  infobox: null,
  loading: false,
  error: null,
  page: 1,
  provider: null,
  setQuery: (query) => set({ query }),
  setProvider: (provider) => set({ provider }),
  search: async (q, page = 1, provider) => {
    const resolvedProvider = provider ?? get().provider;
    set({ loading: true, error: null, query: q, page, provider: resolvedProvider });
    try {
      const data = await searchQuery(q, page, 20, resolvedProvider);
      set({
        results: data.results || [],
        suggestions: data.suggestions || [],
        infobox: data.infoboxes?.[0] || null,
        loading: false,
        page: data.page || page,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
  clearResults: () => set({ results: [], query: "", error: null, suggestions: [], infobox: null }),
}));