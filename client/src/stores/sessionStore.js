import { create } from "zustand";

function loadSession() {
  try {
    return localStorage.getItem("qwry_session_id");
  } catch {
    return null;
  }
}

function saveSession(id) {
  try {
    localStorage.setItem("qwry_session_id", id);
  } catch {
    /* noop */
  }
}

function generateId() {
  return crypto.randomUUID();
}

export const useSessionStore = create((set, get) => ({
  sessionId: loadSession() || (() => {
    const id = generateId();
    saveSession(id);
    return id;
  })(),
  setSessionId: (id) => {
    saveSession(id);
    set({ sessionId: id });
  },
}));