import { apiFetch } from "./client";

const BASE = "/api";

export async function llmGenerate(query, results, mode = "short") {
  const res = await apiFetch(`${BASE}/llm/generate`, {
    method: "POST",
    body: JSON.stringify({ query, results, mode }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `LLM generate failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchOverview(query) {
  const res = await apiFetch(`${BASE}/history/overviews?q=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.overview || null;
}
