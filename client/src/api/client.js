import { useSessionStore } from "../stores/sessionStore";

export function apiFetch(url, options = {}) {
  const sid = useSessionStore.getState().sessionId;
  const headers = {
    ...options.headers,
    "X-Session-Id": sid,
  };
  // Don't set Content-Type for GET/HEAD requests without a body
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(url, { ...options, headers });
}
