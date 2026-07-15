import { create } from "zustand";

export const useUIStore = create((set) => ({
  contextMode: "search-assist",
  setContextMode: (mode) => set({ contextMode: mode }),
}));
