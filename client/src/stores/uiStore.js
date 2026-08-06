import { create } from "zustand";

const DEFAULT_ORDER = ["sources", "context", "discovery"];

export const THEMES = [
  "latte",
  "mocha",
  "tokyo-night",
  "everforest",
  "rose-pine",
  "gruvbox",
  "frosted-glass",
];

const THEME_CLASSES = [
  "dark",
  "tokyo-night",
  "everforest",
  "rose-pine",
  "gruvbox",
  "frosted-glass",
];

export function applyThemeClass(theme) {
  const root = document.documentElement;
  for (const cls of THEME_CLASSES) root.classList.remove(cls);
  if (theme === "latte" || theme === "frosted-glass") {
    if (theme === "frosted-glass") root.classList.add("frosted-glass");
    return;
  }
  root.classList.add("dark");
  if (theme !== "mocha") root.classList.add(theme);
}

export function getAccentColor() {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent")
    .trim();
  return val || "#cba6f7";
}

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
    if (THEMES.includes(stored)) return stored;
    if (stored === "light") return "latte";
    if (stored === "dark") return "mocha";
    if (stored === "ember") return "gruvbox";
  } catch {}
  return "mocha";
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
  contextMode: "home",
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

  setTheme: (name) =>
    set((state) => {
      const next = THEMES.includes(name) ? name : "mocha";
      if (next === state.theme) return state;
      saveTheme(next);
      applyThemeClass(next);
      return { theme: next };
    }),
}));
