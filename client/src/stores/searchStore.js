import { create } from "zustand";
import { searchQuery, fetchSuggestions } from "../api/search";
import { useUIStore } from "./uiStore";

export const providers = [
  { value: "searxng", label: "SearXNG" },
  { value: "engine", label: "Engine" },
];

export const useSearchStore = create((set, get) => ({
  query: "",
  results: [],
  imageResults: [],
  videoResults: [],
  newsResults: [],
  suggestions: [],
  infobox: null,
  loading: false,
  error: null,
  page: 1,
  totalResults: 0,
  imagePage: 1,
  videoPage: 1,
  newsPage: 1,
  imageTotal: 0,
  videoTotal: 0,
  newsTotal: 0,
  provider: "searxng",
  activeFilter: "all",
  setQuery: (query) => set({ query }),
  setProvider: (provider) => set({ provider }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  search: async (q, page = 1, provider) => {
    useUIStore.getState().setContextMode("search-assist");
    const resolvedProvider = provider ?? get().provider;
    set({ loading: true, error: null, query: q, page, provider: resolvedProvider });
    try {
      const [mainData, imageData, videoData, newsData, suggestions] = await Promise.all([
        searchQuery(q, page, 50, resolvedProvider),
        searchQuery(q, 1, 8, resolvedProvider, "images").catch(() => null),
        searchQuery(q, 1, 8, resolvedProvider, "videos").catch(() => null),
        searchQuery(q, 1, 8, resolvedProvider, "news").catch(() => null),
        fetchSuggestions(q, resolvedProvider).catch(() => []),
      ]);
      set({
        results: mainData.results || [],
        suggestions: suggestions || [],
        infobox: mainData.infoboxes?.[0] || null,
        imageResults: imageData?.results?.filter((r) => r.img_src) || [],
        videoResults: videoData?.results || [],
        newsResults: newsData?.results || [],
        loading: false,
        page: mainData.page || page,
        totalResults: mainData.total_results ?? mainData.results?.length ?? 0,
        imagePage: 1,
        videoPage: 1,
        newsPage: 1,
        imageTotal: imageData?.total_results ?? imageData?.results?.length ?? 0,
        videoTotal: videoData?.total_results ?? videoData?.results?.length ?? 0,
        newsTotal: newsData?.total_results ?? newsData?.results?.length ?? 0,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
  loadMorePages: async () => {
    const { query, page, provider } = get();
    if (!query) return;
    const nextPage = page + 1;
    try {
      const data = await searchQuery(query, nextPage, 50, provider);
      set((s) => ({
        results: [...s.results, ...(data.results || [])],
        page: data.page || nextPage,
        totalResults: data.total_results ?? s.totalResults,
      }));
    } catch {
      set({ error: "Failed to load more results" });
    }
  },
  loadMoreImages: async () => {
    const { query, imagePage, provider } = get();
    if (!query) return;
    const nextPage = imagePage + 1;
    try {
      const data = await searchQuery(query, nextPage, 8, provider, "images");
      set((s) => ({
        imageResults: [...s.imageResults, ...(data.results || [])],
        imagePage: data.page || nextPage,
        imageTotal: data.total_results ?? s.imageTotal,
      }));
    } catch {
      set({ error: "Failed to load more images" });
    }
  },
  loadMoreVideos: async () => {
    const { query, videoPage, provider } = get();
    if (!query) return;
    const nextPage = videoPage + 1;
    try {
      const data = await searchQuery(query, nextPage, 8, provider, "videos");
      set((s) => ({
        videoResults: [...s.videoResults, ...(data.results || [])],
        videoPage: data.page || nextPage,
        videoTotal: data.total_results ?? s.videoTotal,
      }));
    } catch {
      set({ error: "Failed to load more videos" });
    }
  },
  loadMoreNews: async () => {
    const { query, newsPage, provider } = get();
    if (!query) return;
    const nextPage = newsPage + 1;
    try {
      const data = await searchQuery(query, nextPage, 8, provider, "news");
      set((s) => ({
        newsResults: [...s.newsResults, ...(data.results || [])],
        newsPage: data.page || nextPage,
        newsTotal: data.total_results ?? s.newsTotal,
      }));
    } catch {
      set({ error: "Failed to load more news" });
    }
  },
  collectTransferSources: () => {
    const { results, imageResults, videoResults } = get();
    const seen = new Set();
    const items = [];
    for (const r of results) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        url: r.url,
        title: r.title || "",
        snippet: r.snippet || "",
        source: r.source || "",
        mediaUrl: r.img_src || null,
      });
    }
    for (const r of imageResults) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        url: r.url,
        title: r.title || "",
        snippet: r.snippet || "",
        source: r.source || "",
        mediaUrl: r.img_src || r.thumbnail || null,
      });
    }
    for (const r of videoResults) {
      const key = r.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        url: r.url,
        title: r.title || "",
        snippet: r.snippet || "",
        source: r.source || "",
        mediaUrl: r.img_src || r.thumbnail || null,
      });
    }
    return items;
  },
  clearResults: () =>
    set({
      results: [],
      imageResults: [],
      videoResults: [],
      newsResults: [],
      query: "",
      error: null,
      suggestions: [],
      infobox: null,
      totalResults: 0,
      imageTotal: 0,
      videoTotal: 0,
      newsTotal: 0,
    }),
}));
