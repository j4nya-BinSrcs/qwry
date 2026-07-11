import { create } from "zustand";
import { searchQuery } from "../api/search";
import { useUIStore } from "./uiStore";

export const providers = [
  { value: null, label: "Meta" },
  { value: "engine", label: "Engine" },
  { value: "searxng", label: "SearXNG" },
];

export const useSearchStore = create((set, get) => ({
  query: "",
  results: [],
  imageResults: [],
  videoResults: [],
  suggestions: [],
  infobox: null,
  loading: false,
  error: null,
  page: 1,
  provider: null,
  setQuery: (query) => set({ query }),
  setProvider: (provider) => set({ provider }),
  search: async (q, page = 1, provider) => {
    useUIStore.getState().setContextMode("search-assist");
    const resolvedProvider = provider ?? get().provider;
    set({ loading: true, error: null, query: q, page, provider: resolvedProvider });
    try {
      const [mainData, imageData, videoData] = await Promise.all([
        searchQuery(q, page, 20, resolvedProvider),
        searchQuery(q, 1, 12, resolvedProvider, "images").catch(() => null),
        searchQuery(q, 1, 12, resolvedProvider, "videos").catch(() => null),
      ]);
      set({
        results: mainData.results || [],
        suggestions: mainData.suggestions || [],
        infobox: mainData.infoboxes?.[0] || null,
        imageResults: imageData?.results?.filter((r) => r.img_src) || [],
        videoResults: videoData?.results || [],
        loading: false,
        page: mainData.page || page,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
  clearResults: () =>
    set({ results: [], imageResults: [], videoResults: [], query: "", error: null, suggestions: [], infobox: null }),
}));