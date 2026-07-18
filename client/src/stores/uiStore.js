import { create } from "zustand";

const DEFAULT_ORDER = ["sources", "context", "discovery"];

function loadPanelOrder() {
  try {
    const stored = localStorage.getItem("qwry_panel_order");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    }
  } catch {}
  return DEFAULT_ORDER;
}

function savePanelOrder(order) {
  try {
    localStorage.setItem("qwry_panel_order", JSON.stringify(order));
  } catch {}
}

function loadTheme() {
  try {
    const stored = localStorage.getItem("qwry_theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return "light";
}

function saveTheme(theme) {
  try {
    localStorage.setItem("qwry_theme", theme);
  } catch {}
}

export const useUIStore = create((set, get) => ({
  panelOrder: loadPanelOrder(),
  theme: loadTheme(),
  expandedPanel: null,
  contextMode: "search-assist",
  readerUrl: null,
  readerTitle: null,
  readerMediaUrl: null,
  readerVersion: 0,
  summarizeUrl: null,
  summarizeTitle: null,
  summarizeVersion: 0,

  setPanelOrder: (order) => {
    savePanelOrder(order);
    set({ panelOrder: order });
  },

  toggleExpand: (panelId) => {
    const { expandedPanel } = get();
    set({ expandedPanel: expandedPanel === panelId ? null : panelId });
  },

  setContextMode: (mode) => set({ contextMode: mode }),

  openReader: (url, title, mediaUrl) =>
    set((state) => ({
      contextMode: "reader",
      readerUrl: url,
      readerTitle: title || null,
      readerMediaUrl: mediaUrl || null,
      readerVersion: state.readerVersion + 1,
    })),

  openSummarizer: (url, title) =>
    set((state) => ({
      contextMode: "summarizer",
      summarizeUrl: url,
      summarizeTitle: title || null,
      summarizeVersion: state.summarizeVersion + 1,
    })),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      saveTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return { theme: next };
    }),
}));
